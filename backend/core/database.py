"""
database.py
───────────
Async SQLite persistence using aiosqlite.
Tables: call_sessions, analysis_log
"""
import aiosqlite
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parents[1] / "vocalverify.db"


CREATE_SESSIONS_SQL = """
CREATE TABLE IF NOT EXISTS call_sessions (
    session_id      TEXT PRIMARY KEY,
    device_id       TEXT NOT NULL,
    caller_number   TEXT NOT NULL,
    call_direction  TEXT DEFAULT 'INBOUND',
    start_time      TEXT NOT NULL,
    end_time        TEXT,
    latest_verdict  TEXT DEFAULT 'ANALYZING',
    latest_score    REAL DEFAULT 0.0,
    frame_count     INTEGER DEFAULT 0
);
"""

CREATE_ANALYSIS_LOG_SQL = """
CREATE TABLE IF NOT EXISTS analysis_log (
    log_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT NOT NULL,
    timestamp           TEXT NOT NULL,
    outcome_code        TEXT NOT NULL,
    synthetic_score     REAL NOT NULL,
    ml_score            REAL NOT NULL,
    dl_score            REAL NOT NULL,
    confidence          REAL NOT NULL,
    audio_duration_ms   REAL NOT NULL,
    FOREIGN KEY (session_id) REFERENCES call_sessions(session_id)
);
"""


async def init_db() -> None:
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_SESSIONS_SQL)
        await db.execute(CREATE_ANALYSIS_LOG_SQL)
        await db.commit()
    logger.info(f"[DB] Initialized at {DB_PATH}")


async def upsert_session(
    session_id: str,
    device_id: str,
    caller_number: str,
    call_direction: str = "INBOUND",
    latest_verdict: str = "ANALYZING",
    latest_score: float = 0.0,
) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO call_sessions
                (session_id, device_id, caller_number, call_direction, start_time, latest_verdict, latest_score, frame_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(session_id) DO UPDATE SET
                latest_verdict = excluded.latest_verdict,
                latest_score   = excluded.latest_score,
                frame_count    = frame_count + 1
        """, (session_id, device_id, caller_number, call_direction,
              datetime.utcnow().isoformat(), latest_verdict, latest_score))
        await db.commit()


async def close_session(session_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE call_sessions SET end_time = ? WHERE session_id = ?
        """, (datetime.utcnow().isoformat(), session_id))
        await db.commit()


async def log_frame_result(
    session_id: str,
    outcome_code: str,
    synthetic_score: float,
    ml_score: float,
    dl_score: float,
    confidence: float,
    audio_duration_ms: float,
) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO analysis_log
                (session_id, timestamp, outcome_code, synthetic_score, ml_score, dl_score, confidence, audio_duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, datetime.utcnow().isoformat(), outcome_code,
              synthetic_score, ml_score, dl_score, confidence, audio_duration_ms))
        await db.commit()


async def get_recent_sessions(limit: int = 50) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT * FROM call_sessions ORDER BY start_time DESC LIMIT ?
        """, (limit,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_session_frames(session_id: str) -> List[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT * FROM analysis_log
            WHERE session_id = ?
            ORDER BY timestamp ASC
        """, (session_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_threat_stats() -> dict:
    """Aggregate stats for the Threat Analytics dashboard view."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        total = (await (await db.execute("SELECT COUNT(*) as c FROM analysis_log")).fetchone())["c"]
        fakes = (await (await db.execute(
            "SELECT COUNT(*) as c FROM analysis_log WHERE outcome_code IN ('AI_IMPERSONATION','HIGH_RISK')"
        )).fetchone())["c"]
        avg_score = (await (await db.execute(
            "SELECT AVG(synthetic_score) as s FROM analysis_log"
        )).fetchone())["s"] or 0.0
        total_sessions = (await (await db.execute(
            "SELECT COUNT(*) as c FROM call_sessions"
        )).fetchone())["c"]

        return {
            "totalFramesAnalyzed": total,
            "deepfakesIntercepted": fakes,
            "averageSyntheticScore": round(avg_score, 4),
            "totalSessions": total_sessions,
        }
