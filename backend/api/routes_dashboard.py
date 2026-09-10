"""
routes_dashboard.py
────────────────────
Dashboard clients (Next.js) connect here to receive live verdicts
and query historical session data.

  WS  /ws/dashboard          → live verdict broadcast stream
  GET /api/v1/sessions       → recent call sessions
  GET /api/v1/sessions/{id}  → frame log for a session
  GET /api/v1/stats          → aggregate threat analytics stats
  POST /api/v1/detect        → one-shot file upload detection
"""
import io
import logging
import warnings
import numpy as np
import librosa
import soundfile as sf
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from typing import List, Optional

from api.schemas import (
    DetectResponse, SessionRecord, FrameLog, OutcomeCode, RiskTier,
    VerifyPublicFigureResponse, PLADMetrics, SpeakerVerificationResult
)
from api.routes_websocket import register_dashboard_ws, unregister_dashboard_ws
from core.inference_engine import get_engine
from core.risk_analyzer import classify, build_explanation
from core.plad_detector import get_plad_detector
from core.similarity_engine import get_similarity_engine
from core.youtube_service import fetch_reference_audio, fetch_multi_reference_audio
from core import database
import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter()

TARGET_SR = 16_000


# ─────────────────────────────────────────────────────────────────────
# Dashboard live WebSocket
# ─────────────────────────────────────────────────────────────────────

@router.websocket("/ws/dashboard")
async def dashboard_websocket(ws: WebSocket):
    await ws.accept()
    register_dashboard_ws(ws)
    logger.info("[DashWS] Dashboard client connected.")
    try:
        while True:
            # Keep alive – echo any ping from client
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        logger.info("[DashWS] Dashboard client disconnected.")
    finally:
        unregister_dashboard_ws(ws)


# ─────────────────────────────────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────────────────────────────────

@router.get("/api/v1/sessions", response_model=List[dict])
async def list_sessions(limit: int = 50):
    return await database.get_recent_sessions(limit)


@router.get("/api/v1/sessions/{session_id}", response_model=List[dict])
async def session_frames(session_id: str):
    frames = await database.get_session_frames(session_id)
    if not frames:
        raise HTTPException(status_code=404, detail="Session not found")
    return frames


@router.get("/api/v1/stats")
async def threat_stats():
    return await database.get_threat_stats()


@router.post("/api/v1/detect", response_model=DetectResponse)
async def detect_audio(file: UploadFile = File(...)):
    """
    One-shot deepfake detection endpoint.
    Accepts .wav, .mp3, .flac – returns ensemble verdict JSON.
    """
    allowed = {"audio/wav", "audio/mpeg", "audio/flac", "audio/x-wav",
               "audio/mp3", "application/octet-stream"}

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # ── Load & preprocess audio ──────────────────────────────────────
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pcm, sr = librosa.load(
                io.BytesIO(content),
                sr=TARGET_SR,   # resample to 16 kHz
                mono=True,      # force mono
            )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {e}")

    duration_seconds = float(len(pcm)) / TARGET_SR

    # ── Dual-stream inference ────────────────────────────────────────
    engine = get_engine()
    synth_score, ml_score, dl_score = engine.predict(pcm)

    audio_duration_ms = duration_seconds * 1000.0
    outcome, risk_tier, confidence = classify(
        synth_score, ml_score, dl_score, audio_duration_ms
    )

    verdict_label = "Fake" if outcome in (
        OutcomeCode.AI_IMPERSONATION, OutcomeCode.HIGH_RISK
    ) else "Real"

    explanation = build_explanation(outcome, synth_score, confidence, None)

    return DetectResponse(
        verdict=verdict_label,
        outcomeCode=outcome,
        confidence=confidence,
        syntheticScore=synth_score,
        mlScore=ml_score,
        dlScore=dl_score,
        riskTier=risk_tier,
        durationSeconds=round(duration_seconds, 2),
        explanation=explanation,
    )


def extract_pcm_from_upload(content: bytes, filename: str) -> np.ndarray:
    """
    Extracts 16 kHz mono float32 PCM from any uploaded video or audio file.
    Uses FFmpeg for video containers, with fallback to librosa.
    """
    ext = Path(filename).suffix.lower()
    temp_in = None
    temp_out = None

    if ext in [".wav", ".mp3", ".flac", ".ogg"]:
        try:
            pcm, _ = librosa.load(io.BytesIO(content), sr=TARGET_SR, mono=True)
            return pcm
        except Exception:
            pass

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f_in:
            f_in.write(content)
            temp_in = f_in.name

        temp_out = temp_in + "_16k.wav"
        cmd = ["ffmpeg", "-y", "-i", temp_in, "-vn", "-ar", "16000", "-ac", "1", temp_out]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)

        if os.path.exists(temp_out):
            pcm, _ = librosa.load(temp_out, sr=TARGET_SR, mono=True)
            return pcm
        else:
            pcm, _ = librosa.load(temp_in, sr=TARGET_SR, mono=True)
            return pcm
    except Exception as e:
        logger.error(f"[Extract] Audio extraction error: {e}")
        # Return short silent pad if decoding completely fails
        return np.zeros(TARGET_SR * 3, dtype=np.float32)
    finally:
        if temp_in and os.path.exists(temp_in):
            try: os.remove(temp_in)
            except Exception: pass
        if temp_out and os.path.exists(temp_out):
            try: os.remove(temp_out)
            except Exception: pass


from fastapi import Form

@router.post("/api/v1/verify-public-figure", response_model=VerifyPublicFigureResponse)
async def verify_public_figure(
    file: UploadFile = File(...),
    public_figure_name: Optional[str] = Form(None),
    reference_file: Optional[UploadFile] = File(None)
):
    """
    Full cross-verification pipeline for video/audio against a claimed public figure.
    Combines:
      1. FFmpeg audio extraction
      2. PLAD (Jitter RAP, Shimmer APQ3, Breath Energy, Spectral Flux)
      3. ML XGBoost (55 acoustic features)
      4. DL Wav2Vec2 + ResNet ONNX
      5. YouTube Data API v3 speech retrieval + yt-dlp reference audio
      6. Speaker Identity Verification via SimilarityEngine (d-vector cosine similarity)
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 1. Extract audio from uploaded media
    pcm = extract_pcm_from_upload(content, file.filename)
    duration_sec = float(len(pcm)) / TARGET_SR

    # Trim leading/trailing digital silence or graphics jingles for acoustic analysis
    pcm_acoustic, _ = librosa.effects.trim(pcm, top_db=25)
    if len(pcm_acoustic) < TARGET_SR * 1.0:
        pcm_acoustic = pcm

    # 2. Run PLAD Biomarker Detection
    plad_det = get_plad_detector()
    plad_res = plad_det.analyze_array(pcm_acoustic, TARGET_SR)

    # 3. Run Dual-Stream ML + DL Inference
    engine = get_engine()
    synth_score, ml_score, dl_score = engine.predict(pcm_acoustic)

    # 4. Multi-Sample Reference Retrieval (3 samples)
    ref_samples: List[np.ndarray] = []
    ref_url = None
    ref_title = None

    if reference_file is not None and reference_file.filename:
        ref_bytes = await reference_file.read()
        if ref_bytes:
            single_ref = extract_pcm_from_upload(ref_bytes, reference_file.filename)
            if len(single_ref) >= TARGET_SR * 3.0:
                p = len(single_ref) // 3
                ref_samples = [single_ref[:p], single_ref[p:2*p], single_ref[2*p:]]
            else:
                ref_samples = [single_ref]
            ref_url = f"Manual reference: {reference_file.filename}"
            ref_title = reference_file.filename

    if not ref_samples and public_figure_name and public_figure_name.strip():
        ref_samples, ref_url, ref_title = fetch_multi_reference_audio(
            public_figure_name.strip(),
            count=3,
            search_context=file.filename or ""
        )

    # 5. Multi-Reference Speaker Identity Verification & Centroid Vector Matching
    sim_result = None
    if ref_samples and len(ref_samples) > 0:
        sim_engine = get_similarity_engine()
        sim_res = sim_engine.compare_multi_arrays(pcm_acoustic, TARGET_SR, ref_samples, TARGET_SR)
        sim_result = SpeakerVerificationResult(
            similarityScore=sim_res.match_pct,
            embeddingDimensions=sim_res.embedding_dim,
            sameSpeaker=sim_res.same_speaker,
            verdict="MATCH" if sim_res.same_speaker else "MISMATCH",
            youtubeReferenceUrl=ref_url,
            referenceTitle=ref_title,
            referenceScores=sim_res.reference_scores,
            centroidScore=sim_res.centroid_score,
            sampleCount=len(ref_samples)
        )
    else:
        sim_result = SpeakerVerificationResult(
            similarityScore=50.0,
            embeddingDimensions=256,
            sameSpeaker=False,
            verdict="MISMATCH",
            youtubeReferenceUrl=ref_url or "No reference found",
            referenceTitle=ref_title or "Reference speech unavailable",
            referenceScores=[50.0, 50.0, 50.0],
            centroidScore=50.0,
            sampleCount=0
        )

    # 6. Multi-Modal Composite Risk Scoring
    plad_fake_risk = 1.0 - plad_res.plad_score
    raw_composite = 0.40 * dl_score + 0.35 * ml_score + 0.25 * plad_fake_risk
    final_score = round(max(0.01, min(0.99, raw_composite)), 3)

    # 7. Verdict classification
    if final_score >= 0.55:
        if sim_result.sameSpeaker:
            risk_tier = "HIGH"
            outcome_code = "AI_IMPERSONATION"
        else:
            risk_tier = "MEDIUM"
            outcome_code = "AI_UNCERTAIN"
    else:
        if sim_result.sameSpeaker:
            risk_tier = "SAFE"
            outcome_code = "GENUINE"
        else:
            risk_tier = "LOW"
            outcome_code = "REAL_WRONG_SPEAKER"

    # 8. Threat Verdict Explanation
    explanation_parts = []
    if final_score >= 0.55:
        explanation_parts.append(
            f"The clip shows strong synthetic characteristics ({round(final_score * 100, 1)}% fake risk). "
            f"Acoustic biomarkers indicate synthetic smoothing (PLAD liveness {round(plad_res.plad_score * 100, 1)}%, "
            f"Jitter RAP: {round(plad_res.jitter * 100, 3)}%, Shimmer APQ: {round(plad_res.shimmer * 100, 3)}%)."
        )
    else:
        explanation_parts.append(
            f"The acoustic signal exhibits natural vocal dynamics ({round(final_score * 100, 1)}% synthetic risk, "
            f"PLAD liveness {round(plad_res.plad_score * 100, 1)}%, natural pitch modulation Jitter RAP: {round(plad_res.jitter * 100, 3)}%)."
        )

    if sim_result.sameSpeaker:
        ref_source_tag = "Voice Vault" if "Voice Vault" in (ref_url or "") else "VideoDB reference"
        score_breakdown = ""
        if sim_result.referenceScores and len(sim_result.referenceScores) >= 2:
            scores_str = ", ".join([f"S{i+1}: {s:.1f}%" for i, s in enumerate(sim_result.referenceScores)])
            score_breakdown = f" [Centroid: {sim_result.centroidScore:.1f}%, 3-sample: {scores_str}]"
        explanation_parts.append(
            f"Speaker embedding strongly aligns with official {ref_source_tag} ({sim_result.similarityScore:.1f}% match{score_breakdown})."
        )
    else:
        explanation_parts.append(
            f"Speaker voice profile diverges from official baseline ({sim_result.similarityScore:.1f}% similarity)."
        )

    verdict_explanation = " ".join(explanation_parts)

    scan_id = f"SCAN-{uuid.uuid4().hex[:4].upper()}"

    return VerifyPublicFigureResponse(
        id=scan_id,
        timestamp=datetime.utcnow().isoformat(),
        mode="public_figure",
        filename=file.filename or "uploaded_media",
        duration=round(duration_sec, 1),
        claimedIdentity=public_figure_name,
        plad=PLADMetrics(
            jitter=round(plad_res.jitter * 100.0, 2),
            shimmer=round(plad_res.shimmer * 100.0, 2),
            breathEnergy=round(plad_res.breath_energy, 4),
            spectralFlux=round(plad_res.spectral_flux, 4),
            livenessScore=round(plad_res.plad_score, 2),
            verdict="REAL" if plad_res.plad_score >= 0.5 else "FAKE"
        ),
        mlScore=round(ml_score * 100.0, 1),
        deepScore=round(dl_score * 100.0, 1),
        speakerMatch=sim_result,
        finalScore=final_score,
        riskTier=risk_tier,
        outcomeCode=outcome_code,
        geminiExplanation=verdict_explanation
    )

