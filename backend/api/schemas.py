from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from enum import Enum


# ─────────────────────────────────────────────
# Shared Enums
# ─────────────────────────────────────────────

class OutcomeCode(str, Enum):
    ANALYZING = "ANALYZING"
    GENUINE = "GENUINE"
    HIGH_RISK = "HIGH_RISK"
    AI_IMPERSONATION = "AI_IMPERSONATION"


class RiskTier(str, Enum):
    SAFE = "SAFE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# ─────────────────────────────────────────────
# Inbound WebSocket payload (Android overlay)
# ─────────────────────────────────────────────

class TelecomMetadata(BaseModel):
    caller_number: Optional[str] = "Unknown Caller"
    call_direction: Optional[str] = "INBOUND"
    codec: Optional[str] = "AMR-WB"
    timestamp: Optional[int | float | str] = None


class AudioPayload(BaseModel):
    sample_rate: Optional[int] = 16000
    encoding: Optional[str] = "PCM_16BIT"
    audio_bytes_base64: Optional[str] = None


class InboundFrame(BaseModel):
    session_id: Optional[str] = None
    device_id: Optional[str] = "unknown_device"
    target_profile_id: Optional[str] = None
    telecom_metadata: Optional[TelecomMetadata] = Field(default_factory=TelecomMetadata)
    audio_payload: Optional[AudioPayload] = None
    # Support top-level audio keys directly sent by apps
    audio_bytes_base64: Optional[str] = None
    audio: Optional[str] = None
    pcm: Optional[str] = None



# ─────────────────────────────────────────────
# Outbound WebSocket response (back to Android)
# ─────────────────────────────────────────────

class VerdictResponse(BaseModel):
    outcomeCode: OutcomeCode
    matchedTarget: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    syntheticScore: float = Field(ge=0.0, le=1.0)
    mlScore: float = Field(ge=0.0, le=1.0, default=0.0)
    dlScore: float = Field(ge=0.0, le=1.0, default=0.0)
    pladScore: float = Field(ge=0.0, le=1.0, default=0.0)  # PLAD liveness (0=fake, 1=real)
    riskTier: RiskTier = RiskTier.SAFE
    audioDurationMs: float = 0.0
    sessionId: str = ""


# ─────────────────────────────────────────────
# REST endpoint schemas
# ─────────────────────────────────────────────

class DetectResponse(BaseModel):
    """Response for POST /api/v1/detect"""
    verdict: Literal["Real", "Fake"]
    outcomeCode: OutcomeCode
    confidence: float
    syntheticScore: float
    mlScore: float
    dlScore: float
    riskTier: RiskTier
    durationSeconds: float
    explanation: str


class SessionRecord(BaseModel):
    session_id: str
    device_id: str
    caller_number: str
    call_direction: str
    start_time: str
    latest_verdict: str
    latest_score: float
    frame_count: int


class FrameLog(BaseModel):
    log_id: int
    session_id: str
    timestamp: str
    outcome_code: str
    synthetic_score: float
    confidence: float
    audio_duration_ms: float


# ─────────────────────────────────────────────
# Dashboard live broadcast event
# ─────────────────────────────────────────────

class DashboardEvent(BaseModel):
    event_type: Literal[
        "NEW_VERDICT", "SESSION_START", "SESSION_END", "PIPELINE_PROGRESS",
        "PHONE_CONNECTED", "PHONE_DISCONNECTED", "PHONE_STATUS"
    ] = "NEW_VERDICT"
    session_id: Optional[str] = ""
    device_id: Optional[str] = ""
    caller_number: Optional[str] = ""
    verdict: Optional[VerdictResponse] = None
    step: Optional[int] = None
    total_steps: Optional[int] = None
    message: Optional[str] = None
    is_phone_connected: Optional[bool] = None
    connected_devices: Optional[List[str]] = None




# ─────────────────────────────────────────────
# Video & Public Figure Verification Schemas
# ─────────────────────────────────────────────

class PLADMetrics(BaseModel):
    jitter: float
    shimmer: float
    breathEnergy: float
    spectralFlux: float
    livenessScore: float
    verdict: Literal["REAL", "FAKE"]


class SpeakerVerificationResult(BaseModel):
    similarityScore: float
    embeddingDimensions: int = 256
    sameSpeaker: bool
    verdict: Literal["MATCH", "MISMATCH"]
    youtubeReferenceUrl: Optional[str] = None
    referenceTitle: Optional[str] = None
    referenceScores: Optional[List[float]] = None
    centroidScore: Optional[float] = None
    sampleCount: Optional[int] = 3


class VerifyPublicFigureResponse(BaseModel):
    id: str
    timestamp: str
    mode: Literal["quick", "call", "public_figure"] = "public_figure"
    filename: str
    duration: float
    claimedIdentity: Optional[str] = None
    plad: PLADMetrics
    mlScore: float
    deepScore: float
    speakerMatch: Optional[SpeakerVerificationResult] = None
    finalScore: float
    riskTier: Literal["HIGH", "MEDIUM", "LOW", "SAFE"]
    outcomeCode: Literal["AI_IMPERSONATION", "AI_UNCERTAIN", "REAL_WRONG_SPEAKER", "GENUINE"]
    geminiExplanation: str

