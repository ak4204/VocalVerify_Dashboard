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
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.schemas import InboundFrame, VerdictResponse, DashboardEvent
import time
from core.audio_decoder import decode_pcm16_b64, decode_pcm16_bytes, get_or_create_buffer, destroy_buffer
from core.inference_engine import get_engine
from core.plad_detector import get_plad_detector
from core.risk_analyzer import classify, build_explanation
from core.speaker_verification import is_user_voice
from core import database

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Dashboard broadcast registry (populated in routes_dashboard.py) ──
_dashboard_connections: set["WebSocket"] = set()
_active_phone_devices: dict[str, WebSocket] = {}


def register_dashboard_ws(ws: WebSocket) -> None:
    _dashboard_connections.add(ws)


def unregister_dashboard_ws(ws: WebSocket) -> None:
    _dashboard_connections.discard(ws)


def get_active_phone_devices() -> dict[str, WebSocket]:
    return _active_phone_devices


async def _broadcast(event: DashboardEvent) -> None:
    payload = event.model_dump_json()
    dead = set()
    for ws in list(_dashboard_connections):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _dashboard_connections.discard(ws)



# ─────────────────────────────────────────────────────────────────────

# Registry for dashboard audio monitor connections (browser listeners)
_audio_monitor_connections: set["WebSocket"] = set()


async def _forward_audio(pcm_bytes: bytes) -> None:
    """Forward raw PCM-16 bytes to all browser audio monitor tabs."""
    dead = set()
    for ws in list(_audio_monitor_connections):
        try:
            await ws.send_bytes(pcm_bytes)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _audio_monitor_connections.discard(ws)


TARGET_PROFILE_MAP = {
    "cfo_sarah_jenkins": "Sarah Jenkins (CFO)",
    "ceo_john_doe": "John Doe (CEO)",
    "sbi_support": "SBI Support Vault",
}


@router.websocket("/ws/telephony")
@router.websocket("/ws/telephony/{device_id}")
async def telephony_websocket(ws: WebSocket, device_id: str = "default_device"):
    await ws.accept()

    # ── Audio Monitor: treat dashboard_audio_monitor as a passive listener ──
    if device_id == "dashboard_audio_monitor":
        _audio_monitor_connections.add(ws)
        logger.info(f"[WS] Dashboard audio monitor connected (total: {len(_audio_monitor_connections)})")
        try:
            while True:
                msg = await ws.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                if msg.get("text") == "ping":
                    await ws.send_text("pong")
        except Exception:
            pass
        finally:
            _audio_monitor_connections.discard(ws)
            logger.info(f"[WS] Dashboard audio monitor disconnected (remaining: {len(_audio_monitor_connections)})")
        return

    _active_phone_devices[device_id] = ws
    logger.info(f"[WS] Phone/App connected: device_id={device_id} (active phones: {len(_active_phone_devices)})")
    
    # Immediately notify dashboard that a phone has connected
    await _broadcast(DashboardEvent(
        event_type="PHONE_CONNECTED",
        device_id=device_id,
        is_phone_connected=True,
        connected_devices=list(_active_phone_devices.keys()),
        message=f"Mobile Call Guard connected ({device_id})"
    ))

    engine = get_engine()
    current_session_id: str = f"sess_{device_id}_{int(time.time())}"
    caller_number: str = "Incoming Call"
    call_direction: str = "INBOUND"
    matched_target: str | None = None


    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            pcm_chunk = None

            # ── 1. Handle Binary Audio Frames ────────────────────────
            if "bytes" in msg and msg["bytes"]:
                pcm_chunk = decode_pcm16_bytes(msg["bytes"])
                # Forward raw PCM bytes to any dashboard audio monitor tabs
                if _audio_monitor_connections and pcm_chunk is not None and len(pcm_chunk) > 0:
                    pcm_int16_bytes = (pcm_chunk * 32767).astype(np.int16).tobytes()
                    peak_amp = float(np.max(np.abs(pcm_chunk)))
                    logger.info(f"[AudioForward] Binary frame: {len(pcm_int16_bytes)} bytes, peak={peak_amp:.4f}, monitors={len(_audio_monitor_connections)}")
                    await _forward_audio(pcm_int16_bytes)

            # ── 2. Handle Text JSON Payloads ─────────────────────────
            elif "text" in msg and msg["text"]:
                raw_text = msg["text"]
                if raw_text == "ping":
                    await ws.send_text("pong")
                    continue

                b64_audio = None
                try:
                    data = json.loads(raw_text)
                    if isinstance(data, dict):
                        # Extract session & metadata
                        if data.get("session_id"):
                            current_session_id = str(data["session_id"])
                        elif data.get("sessionId"):
                            current_session_id = str(data["sessionId"])

                        if data.get("target_profile_id"):
                            raw_target = str(data["target_profile_id"])
                            matched_target = TARGET_PROFILE_MAP.get(raw_target, raw_target)
                        elif data.get("targetProfileId"):
                            raw_target = str(data["targetProfileId"])
                            matched_target = TARGET_PROFILE_MAP.get(raw_target, raw_target)

                        telecom = data.get("telecom_metadata") or data.get("telecomMetadata") or {}
                        if isinstance(telecom, dict):
                            caller_number = telecom.get("caller_number") or telecom.get("callerNumber") or caller_number
                            call_direction = telecom.get("call_direction") or telecom.get("callDirection") or call_direction

                        if data.get("caller_number"):
                            caller_number = str(data["caller_number"])
                        elif data.get("caller"):
                            caller_number = str(data["caller"])

                        # Extract base64 audio
                        payload_obj = data.get("audio_payload") or data.get("audioPayload")
                        if isinstance(payload_obj, dict):
                            b64_audio = payload_obj.get("audio_bytes_base64") or payload_obj.get("audioBytesBase64")
                        elif isinstance(payload_obj, str):
                            b64_audio = payload_obj

                        if not b64_audio:
                            b64_audio = data.get("audio_bytes_base64") or data.get("audioBytesBase64") or data.get("audio") or data.get("pcm")
                except Exception as parse_err:
                    logger.warning(f"[WS] Payload parse warning: {parse_err}")

                if b64_audio:
                    pcm_chunk = decode_pcm16_b64(b64_audio)
                    # Forward decoded PCM to browser audio monitor (convert float32 → PCM-16 bytes)
                    if _audio_monitor_connections and pcm_chunk is not None and len(pcm_chunk) > 0:
                        pcm_int16_bytes = (pcm_chunk * 32767).astype(np.int16).tobytes()
                        peak_amp = float(np.max(np.abs(pcm_chunk)))
                        non_zero_count = int(np.count_nonzero(pcm_chunk))
                        logger.info(
                            f"[AudioForward] B64 frame: {len(pcm_int16_bytes)} bytes, "
                            f"non-zero samples: {non_zero_count}/{len(pcm_chunk)}, "
                            f"peak={peak_amp:.4f}, monitors={len(_audio_monitor_connections)}"
                        )
                        await _forward_audio(pcm_int16_bytes)

            if pcm_chunk is None or len(pcm_chunk) == 0:
                continue

            # ── 3. Voice Similarity Filter (ECAPA-TDNN) ──────────────
            if is_user_voice(pcm_chunk):
                logger.debug("User's voice detected (ECAPA-TDNN). Dropping chunk.")
                continue

            session_buf = get_or_create_buffer(current_session_id)
            await session_buf.append(pcm_chunk)

            # ── Get context window for inference ─────────────────────
            audio_window = await session_buf.get_window(seconds=3.0)
            buf_duration_ms = session_buf.buffer_duration_ms

            # Need at least ~512 samples for reliable inference
            if len(audio_window) < 512:
                analyzing_verdict = VerdictResponse(
                    outcomeCode="ANALYZING",
                    matchedTarget=matched_target,
                    confidence=0.5,
                    syntheticScore=0.0,
                    mlScore=0.0,
                    dlScore=0.0,
                    pladScore=0.5,
                    riskTier="SAFE",
                    audioDurationMs=buf_duration_ms,
                    sessionId=current_session_id,
                )
                await ws.send_text(analyzing_verdict.model_dump_json())
                continue

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
                plad_score = 0.5

            # ── Build verdict ─────────────────────────────────────────
            verdict = VerdictResponse(
                outcomeCode=outcome,
                matchedTarget=matched_target,
                confidence=confidence,
                syntheticScore=synth_score,
                mlScore=ml_score,
                dlScore=dl_score,
                pladScore=plad_score,
                riskTier=risk_tier,
                audioDurationMs=buf_duration_ms,
                sessionId=current_session_id,
            )

            # ── Persist to DB (async, non-blocking) ──────────────────
            try:
                await database.upsert_session(
                    session_id=current_session_id,
                    device_id=device_id,
                    caller_number=caller_number,
                    call_direction=call_direction,
                    latest_verdict=outcome.value,
                    latest_score=synth_score,
                )
                await database.log_frame_result(
                    session_id=current_session_id,
                    outcome_code=outcome.value,
                    synthetic_score=synth_score,
                    ml_score=ml_score,
                    dl_score=dl_score,
                    confidence=confidence,
                    audio_duration_ms=buf_duration_ms,
                )
            except Exception as db_err:
                logger.debug(f"[DB] Session log error (non-fatal): {db_err}")

            # ── Broadcast to dashboard ────────────────────────────────
            event = DashboardEvent(
                event_type="NEW_VERDICT",
                session_id=current_session_id,
                device_id=device_id,
                caller_number=caller_number,
                verdict=verdict,
            )
            await _broadcast(event)

            # ── Respond to Android overlay / Telephony App ────────────
            await ws.send_text(verdict.model_dump_json())
            logger.debug(f"[WS] Verdict sent: {outcome.value} score={synth_score:.3f}")

    except WebSocketDisconnect:
        logger.info(f"[WS] Device {device_id} disconnected.")
    except Exception as exc:
        logger.error(f"[WS] Telephony stream error: {exc}")
    finally:
        if _active_phone_devices.get(device_id) is ws:
            _active_phone_devices.pop(device_id, None)
            logger.info(f"[WS] Device {device_id} unregistered (remaining active phones: {len(_active_phone_devices)})")
            await _broadcast(DashboardEvent(
                event_type="PHONE_DISCONNECTED",
                device_id=device_id,
                is_phone_connected=len(_active_phone_devices) > 0,
                connected_devices=list(_active_phone_devices.keys()),
                message=f"Mobile Call Guard disconnected ({device_id})"
            ))
        if current_session_id:
            await destroy_buffer(current_session_id)
            try:
                await database.close_session(current_session_id)
            except Exception:
                pass
            await _broadcast(DashboardEvent(
                event_type="SESSION_END",
                session_id=current_session_id,
                device_id=device_id,
                caller_number=caller_number,
                verdict=VerdictResponse(
                    outcomeCode="ANALYZING", confidence=0, syntheticScore=0,
                    sessionId=current_session_id
                ),
            ))


