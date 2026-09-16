"""
audio_decoder.py
────────────────
Decodes raw PCM-16bit Base64 audio chunks from the Android overlay
and maintains per-session rolling buffers.
"""
import base64
import numpy as np
import asyncio
from collections import defaultdict
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

TARGET_SR = 16_000
BUFFER_MAX_SECONDS = 5.0
BUFFER_MAX_SAMPLES = int(TARGET_SR * BUFFER_MAX_SECONDS)


def decode_pcm16_bytes(raw_bytes: bytes) -> np.ndarray:
    """
    Decode raw PCM-16 mono 16kHz bytes into float32 numpy array normalised to [-1.0, 1.0].
    Safely strips WAV headers if present and handles odd byte lengths.
    """
    if not raw_bytes:
        return np.array([], dtype=np.float32)

    # Detect & skip 44-byte WAV header if present (RIFF...WAVEfmt )
    if len(raw_bytes) > 44 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WAVE":
        raw_bytes = raw_bytes[44:]

    # Ensure even number of bytes for 16-bit PCM
    if len(raw_bytes) % 2 != 0:
        raw_bytes = raw_bytes[:len(raw_bytes) - 1]

    if len(raw_bytes) == 0:
        return np.array([], dtype=np.float32)

    pcm_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
    return pcm_int16.astype(np.float32) / 32768.0


def decode_pcm16_b64(b64_string: str) -> np.ndarray:
    """
    Decode a Base64-encoded raw PCM-16 mono 16kHz byte string
    into a float32 numpy array normalised to [-1.0, 1.0].
    Tolerates whitespace, missing padding, and URL-safe characters.
    """
    if not b64_string:
        return np.array([], dtype=np.float32)

    clean_b64 = b64_string.strip().replace("-", "+").replace("_", "/")
    # Add missing base64 padding if needed
    missing_padding = len(clean_b64) % 4
    if missing_padding:
        clean_b64 += "=" * (4 - missing_padding)

    try:
        raw_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        logger.warning(f"[AudioDecoder] Failed base64 decode: {e}")
        return np.array([], dtype=np.float32)

    return decode_pcm16_bytes(raw_bytes)



class SessionBuffer:
    """
    Per-session rolling audio buffer.
    Maintains the most recent BUFFER_MAX_SECONDS of audio as float32 samples.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self._buffer: np.ndarray = np.array([], dtype=np.float32)
        self._total_frames: int = 0
        self._total_samples: int = 0
        self._lock = asyncio.Lock()

    async def append(self, chunk: np.ndarray) -> None:
        async with self._lock:
            self._buffer = np.concatenate([self._buffer, chunk])
            self._total_frames += 1
            self._total_samples += len(chunk)
            # Trim to last BUFFER_MAX_SECONDS
            if len(self._buffer) > BUFFER_MAX_SAMPLES:
                self._buffer = self._buffer[-BUFFER_MAX_SAMPLES:]

    async def get_window(self, seconds: float = 3.0) -> np.ndarray:
        """Return the most recent `seconds` of audio."""
        async with self._lock:
            n_samples = int(TARGET_SR * seconds)
            return self._buffer[-n_samples:].copy() if len(self._buffer) >= n_samples else self._buffer.copy()

    @property
    def total_duration_ms(self) -> float:
        return (self._total_samples / TARGET_SR) * 1000.0

    @property
    def buffer_duration_ms(self) -> float:
        return (len(self._buffer) / TARGET_SR) * 1000.0

    async def clear(self) -> None:
        async with self._lock:
            self._buffer = np.array([], dtype=np.float32)
            self._total_samples = 0
            self._total_frames = 0


# ─────────────────────────────────────────────────────────────
# Global session buffer registry (in-memory, per process)
# ─────────────────────────────────────────────────────────────

_session_buffers: Dict[str, SessionBuffer] = {}


def get_or_create_buffer(session_id: str) -> SessionBuffer:
    if session_id not in _session_buffers:
        _session_buffers[session_id] = SessionBuffer(session_id)
        logger.info(f"[Buffer] Created new buffer for session {session_id}")
    return _session_buffers[session_id]


async def destroy_buffer(session_id: str) -> None:
    buf = _session_buffers.pop(session_id, None)
    if buf:
        await buf.clear()
        logger.info(f"[Buffer] Destroyed buffer for session {session_id}")


def active_session_count() -> int:
    return len(_session_buffers)
