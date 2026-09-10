"""
routes_websocket.py
────────────────────
Phone overlay WebSocket endpoint:
  wss://YOUR-DOMAIN/ws/telephony/{device_id}

Receives Base64 PCM-16 frames every ~1.5 s, runs inference,
persists result, broadcasts to dashboard clients, responds immediately.
"""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.schemas import InboundFrame, VerdictResponse, DashboardEvent
from core.audio_decoder import decode_pcm16_b64, get_or_create_buffer, destroy_buffer
from core.inference_engine import get_engine
from core.plad_detector import get_plad_detector
from core.risk_analyzer import classify, build_explanation
from core import database

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Dashboard broadcast registry (populated in routes_dashboard.py) ──
_dashboard_connections: set["WebSocket"] = set()


def register_dashboard_ws(ws: WebSocket) -> None:
    _dashboard_connections.add(ws)


def unregister_dashboard_ws(ws: WebSocket) -> None:
    _dashboard_connections.discard(ws)


async def _broadcast(event: DashboardEvent) -> None:
    payload = event.model_dump_json()
    dead = set()
    for ws in _dashboard_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    _dashboard_connections -= dead


# ─────────────────────────────────────────────────────────────────────

@router.websocket("/ws/telephony/{device_id}")
async def telephony_websocket(ws: WebSocket, device_id: str):
    await ws.accept()
    logger.info(f"[WS] Phone connected: device_id={device_id}")
    engine = get_engine()
    current_session_id: str | None = None

    try:
        while True:
            raw = await ws.receive_text()

            # ── Parse frame ──────────────────────────────────────────
            try:
                frame = InboundFrame.model_validate_json(raw)
            except Exception as e:
                await ws.send_text(json.dumps({"error": f"Invalid payload: {e}"}))
                continue

            current_session_id = frame.session_id
            session_buf = get_or_create_buffer(frame.session_id)

            # ── Decode PCM ───────────────────────────────────────────
            try:
                pcm_chunk = decode_pcm16_b64(frame.audio_payload.audio_bytes_base64)
            except Exception as e:
                await ws.send_text(json.dumps({"error": f"Audio decode error: {e}"}))
                continue

            await session_buf.append(pcm_chunk)

            # ── Get context window for inference ─────────────────────
            audio_window = await session_buf.get_window(seconds=3.0)
            buf_duration_ms = session_buf.buffer_duration_ms

            # ── Run inference ────────────────────────────────────────
            synth_score, ml_score, dl_score = engine.predict(audio_window)
            outcome, risk_tier, confidence = classify(
                synth_score, ml_score, dl_score, buf_duration_ms
            )

            # ── PLAD liveness analysis ───────────────────────────────
            try:
                plad_result = get_plad_detector().analyze_array(audio_window, sr=16000)
                plad_score = plad_result.plad_score  # 0=fake, 1=real
            except Exception:
                plad_score = 0.0

            # ── Build verdict ─────────────────────────────────────────
            verdict = VerdictResponse(
                outcomeCode=outcome,
                matchedTarget=frame.target_profile_id,
                confidence=confidence,
                syntheticScore=synth_score,
                mlScore=ml_score,
                dlScore=dl_score,
                pladScore=plad_score,
                riskTier=risk_tier,
                audioDurationMs=buf_duration_ms,
                sessionId=frame.session_id,
            )

            # ── Persist to DB (async, non-blocking) ──────────────────
            await database.upsert_session(
                session_id=frame.session_id,
                device_id=frame.device_id,
                caller_number=frame.telecom_metadata.caller_number,
                call_direction=frame.telecom_metadata.call_direction,
                latest_verdict=outcome.value,
                latest_score=synth_score,
            )
            await database.log_frame_result(
                session_id=frame.session_id,
                outcome_code=outcome.value,
                synthetic_score=synth_score,
                ml_score=ml_score,
                dl_score=dl_score,
                confidence=confidence,
                audio_duration_ms=buf_duration_ms,
            )

            # ── Broadcast to dashboard ────────────────────────────────
            event = DashboardEvent(
                event_type="NEW_VERDICT",
                session_id=frame.session_id,
                device_id=frame.device_id,
                caller_number=frame.telecom_metadata.caller_number,
                verdict=verdict,
            )
            await _broadcast(event)

            # ── Respond to Android overlay ───────────────────────────
            await ws.send_text(verdict.model_dump_json())
            logger.debug(f"[WS] Verdict sent: {outcome.value} score={synth_score:.3f}")

    except WebSocketDisconnect:
        logger.info(f"[WS] Device {device_id} disconnected.")
    finally:
        if current_session_id:
            await destroy_buffer(current_session_id)
            await database.close_session(current_session_id)
            await _broadcast(DashboardEvent(
                event_type="SESSION_END",
                session_id=current_session_id,
                device_id=device_id,
                caller_number="unknown",
                verdict=VerdictResponse(
                    outcomeCode="ANALYZING", confidence=0, syntheticScore=0,
                    sessionId=current_session_id
                ),
            ))
