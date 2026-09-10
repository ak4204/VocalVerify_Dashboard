"""
risk_analyzer.py
─────────────────
Maps (synthetic_score, confidence, audio_duration) → outcomeCode + riskTier.

Decision table (from spec):
  Duration < 1500 ms              → ANALYZING
  synth < 0.35 AND conf ≥ 0.75   → GENUINE  / SAFE
  0.35 ≤ synth ≤ 0.70            → HIGH_RISK / MEDIUM
  synth > 0.70                   → AI_IMPERSONATION / HIGH

The confidence value is derived from 1 - |0.5 - synth| * 2 so that
extreme scores (near 0 or 1) map to high confidence.
"""
from api.schemas import OutcomeCode, RiskTier


def derive_confidence(synth_score: float) -> float:
    """
    Confidence = how certain the model is (regardless of direction).
    High synthetic or very low synthetic both give high confidence.
    Mid-range (~0.5) gives low confidence.
    """
    return round(abs(synth_score - 0.5) * 2.0, 4)


def classify(
    synth_score: float,
    ml_score: float,
    dl_score: float,
    audio_duration_ms: float,
) -> tuple[OutcomeCode, RiskTier, float]:
    """
    Returns (outcomeCode, riskTier, confidence).
    """
    confidence = derive_confidence(synth_score)

    # ── Insufficient audio ──────────────────────────────────────────
    if audio_duration_ms < 1500:
        return OutcomeCode.ANALYZING, RiskTier.SAFE, confidence

    # ── Decision table ──────────────────────────────────────────────
    if synth_score > 0.70:
        return OutcomeCode.AI_IMPERSONATION, RiskTier.HIGH, confidence

    if 0.35 <= synth_score <= 0.70:
        return OutcomeCode.HIGH_RISK, RiskTier.MEDIUM, confidence

    if synth_score < 0.35 and confidence >= 0.75:
        return OutcomeCode.GENUINE, RiskTier.SAFE, confidence

    # Borderline: low synth score but not enough confidence
    return OutcomeCode.GENUINE, RiskTier.LOW, confidence


def build_explanation(
    outcome: OutcomeCode,
    synth_score: float,
    confidence: float,
    matched_target: str | None,
) -> str:
    """Generate a human-readable explanation for the dashboard."""
    if outcome == OutcomeCode.ANALYZING:
        return "Insufficient audio collected. Continue streaming for a verdict."
    if outcome == OutcomeCode.AI_IMPERSONATION:
        tgt = f" The voice strongly matches the enrolled profile for {matched_target}." if matched_target else ""
        return (
            f"⚠️ AI voice cloning detected with {synth_score*100:.1f}% synthetic probability.{tgt} "
            "Do NOT act on any requests made during this call."
        )
    if outcome == OutcomeCode.HIGH_RISK:
        return (
            f"Elevated risk: synthetic probability is {synth_score*100:.1f}%. "
            "The voice exhibits borderline artifacts. Treat with caution."
        )
    return (
        f"Voice verified as authentic (synthetic probability: {synth_score*100:.1f}%, "
        f"confidence: {confidence*100:.1f}%)."
    )
