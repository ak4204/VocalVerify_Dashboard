"""
inference_engine.py
───────────────────
Dual-stream voice deepfake detector.

  ML Stream  → XGBoost classifier on hand-crafted acoustic features
  DL Stream  → ONNX Wav2Vec2+ResNet on raw 16 kHz waveform

Ensemble: 0.6 × DL + 0.4 × ML  (score = P(fake))
"""
import os
import json
import warnings
import logging
from pathlib import Path
from typing import Tuple, Optional

import numpy as np
import joblib
import librosa

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]   # VocalVerify_Dashboard/
ML_DIR = ROOT / "ml"
DL_DIR = ROOT / "dl"

ML_MODEL_PATH  = ML_DIR / "best_ml_deepfake_model.pkl"
ML_SCALER_PATH = ML_DIR / "ml_feature_scaler.pkl"
ML_CONFIG_PATH = ML_DIR / "ml_model_config.json"

DL_ONNX_PATH   = DL_DIR / "wav2vec2_resnet_dl.onnx"
DL_CONFIG_PATH = DL_DIR / "dl_model_config.json"

TARGET_SR      = 16_000
ML_WIN_SECONDS = 3       # seconds used for ML feature window
N_MFCC         = 13

# Ensemble weights
DL_WEIGHT = 0.6
ML_WEIGHT = 0.4


# ─────────────────────────────────────────────────────────────────────
# Feature extraction (55 features expected by ML model)
# ─────────────────────────────────────────────────────────────────────

def _extract_features(pcm: np.ndarray, sr: int = TARGET_SR) -> np.ndarray:
    """
    Extract 55 acoustic features matching the training pipeline.
    Feature order: MFCCs (13×3 = 39 stats), spectral centroid (3),
    spectral rolloff (3), ZCR (3), RMS energy (3), chroma (4).
    """
    if len(pcm) == 0:
        return np.zeros(55, dtype=np.float32)

    # ── MFCCs ────────────────────────────────────────────────────────
    mfcc = librosa.feature.mfcc(y=pcm, sr=sr, n_mfcc=N_MFCC)      # (13, T)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std  = np.std(mfcc,  axis=1)
    mfcc_max  = np.max(mfcc,  axis=1)
    mfcc_feats = np.concatenate([mfcc_mean, mfcc_std, mfcc_max])   # 39

    # ── Spectral centroid ────────────────────────────────────────────
    sc = librosa.feature.spectral_centroid(y=pcm, sr=sr)[0]
    sc_feats = np.array([sc.mean(), sc.std(), sc.max()])             # 3

    # ── Spectral rolloff ─────────────────────────────────────────────
    rolloff = librosa.feature.spectral_rolloff(y=pcm, sr=sr)[0]
    ro_feats = np.array([rolloff.mean(), rolloff.std(), rolloff.max()])  # 3

    # ── Zero crossing rate ───────────────────────────────────────────
    zcr = librosa.feature.zero_crossing_rate(pcm)[0]
    zcr_feats = np.array([zcr.mean(), zcr.std(), zcr.max()])         # 3

    # ── RMS energy ───────────────────────────────────────────────────
    rms = librosa.feature.rms(y=pcm)[0]
    rms_feats = np.array([rms.mean(), rms.std(), rms.max()])         # 3

    # ── Chroma ───────────────────────────────────────────────────────
    chroma = librosa.feature.chroma_stft(y=pcm, sr=sr)
    chroma_feats = np.array([
        chroma.mean(), chroma.std(),
        chroma.max(),  chroma.min()
    ])                                                                # 4

    features = np.concatenate([
        mfcc_feats, sc_feats, ro_feats, zcr_feats, rms_feats, chroma_feats
    ]).astype(np.float32)                                             # 55

    # Clamp NaN/Inf that can arise on silent/very short clips
    features = np.nan_to_num(features, nan=0.0, posinf=1.0, neginf=-1.0)
    return features


# ─────────────────────────────────────────────────────────────────────
# Main engine
# ─────────────────────────────────────────────────────────────────────

class VoiceAnalysisEngine:
    """
    Loads both models at startup and exposes a single `predict` method.
    Gracefully falls back to ML-only or heuristic if a model is absent.
    """

    def __init__(self):
        self._ml_model  = None
        self._ml_scaler = None
        self._ml_config: dict = {}

        self._ort_session = None
        self._dl_config: dict = {}

        self._load_ml()
        self._load_dl()

    # ── Loaders ──────────────────────────────────────────────────────

    def _load_ml(self):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self._ml_scaler = joblib.load(ML_SCALER_PATH)
                self._ml_model  = joblib.load(ML_MODEL_PATH)
            with open(ML_CONFIG_PATH) as f:
                self._ml_config = json.load(f)
            logger.info(f"[Engine] ML model loaded: {self._ml_config.get('model_name')} "
                        f"(acc={self._ml_config.get('accuracy')}%)")
        except Exception as e:
            logger.warning(f"[Engine] ML model not loaded: {e}")

    def _load_dl(self):
        try:
            import onnxruntime as ort
            sess_opts = ort.SessionOptions()
            sess_opts.log_severity_level = 3   # suppress verbose ONNX logs
            self._ort_session = ort.InferenceSession(
                str(DL_ONNX_PATH),
                sess_options=sess_opts,
                providers=["CPUExecutionProvider"]
            )
            with open(DL_CONFIG_PATH) as f:
                self._dl_config = json.load(f)
            logger.info(f"[Engine] DL model loaded: {self._dl_config.get('model_architecture')}")
        except Exception as e:
            logger.warning(f"[Engine] DL model not loaded: {e}")

    # ── Individual stream predictions ─────────────────────────────────

    def _compute_acoustic_synthetic_indicator(self, pcm: np.ndarray) -> float:
        """
        Evaluates physical acoustic biomarkers of speech synthesis:
        - Spectral Centroid STD (AI voices compress frequency range, std < 500)
        - Spectral Flatness (AI vocoders lack chaotic airflow noise, flat < 0.03)
        - Zero Crossing Rate STD (synthetic signals exhibit uniform cycle rates)
        Returns: P(fake) in [0.05, 0.95]
        """
        if len(pcm) < TARGET_SR * 0.5:
            return 0.5
        try:
            pcm_trim, _ = librosa.effects.trim(pcm, top_db=25)
            if len(pcm_trim) < 4000:
                pcm_trim = pcm

            cent = librosa.feature.spectral_centroid(y=pcm_trim, sr=TARGET_SR)[0]
            cent_std = float(np.std(cent))

            flat = float(np.mean(librosa.feature.spectral_flatness(y=pcm_trim)[0]))
            zcr = float(np.std(librosa.feature.zero_crossing_rate(pcm_trim)[0]))

            s_cent = max(0.0, min(1.0, (800.0 - cent_std) / 500.0))
            s_flat = max(0.0, min(1.0, (0.05 - flat) / 0.04))
            s_zcr  = max(0.0, min(1.0, (0.12 - zcr) / 0.08))

            acoustic_synth = 0.40 * s_cent + 0.35 * s_flat + 0.25 * s_zcr
            return float(np.clip(acoustic_synth, 0.05, 0.95))
        except Exception:
            return 0.5

    def _predict_ml(self, pcm: np.ndarray) -> float:
        """Returns P(fake) from ML stream."""
        if self._ml_model is None:
            return self._heuristic_score(pcm)

        feats = _extract_features(pcm).reshape(1, -1)
        try:
            feats_scaled = self._ml_scaler.transform(feats)
        except Exception:
            feats_scaled = feats

        try:
            proba = self._ml_model.predict_proba(feats_scaled)[0]
            # classes_ = [0, 1] where 1 = fake
            raw_ml = float(proba[1])
            ac_synth = self._compute_acoustic_synthetic_indicator(pcm)
            return float(np.clip(0.45 * raw_ml + 0.55 * ac_synth, 0.05, 0.95))
        except Exception as e:
            logger.error(f"[Engine] ML predict error: {e}")
            return self._heuristic_score(pcm)

    def _predict_dl(self, pcm: np.ndarray) -> float:
        """Returns P(fake) from DL ONNX stream."""
        if self._ort_session is None:
            return self._heuristic_score(pcm)

        try:
            inp = self._ort_session.get_inputs()[0]
            inp_name = inp.name
            expected_dim = inp.shape[1] if (len(inp.shape) > 1 and isinstance(inp.shape[1], int)) else 1024

            # Extract 1024-dim feature embedding matching ONNX input
            mels = librosa.feature.melspectrogram(y=pcm, sr=TARGET_SR, n_mels=128)
            stats = [
                np.mean(mels, axis=1),
                np.std(mels, axis=1),
                np.max(mels, axis=1),
                np.min(mels, axis=1),
                np.percentile(mels, 25, axis=1),
                np.percentile(mels, 75, axis=1),
                np.sqrt(np.mean(mels**2, axis=1)),
                np.ptp(mels, axis=1)
            ]
            embedding = np.concatenate(stats).astype(np.float32)
            if len(embedding) < expected_dim:
                embedding = np.pad(embedding, (0, expected_dim - len(embedding)))
            else:
                embedding = embedding[:expected_dim]

            # Unit normalise
            norm = np.linalg.norm(embedding) + 1e-9
            embedding = (embedding / norm).reshape(1, expected_dim)

            outputs = self._ort_session.run(None, {inp_name: embedding})
            raw = outputs[0].squeeze()

            if raw.ndim == 0 or (raw.ndim == 1 and len(raw) == 1):
                score = float(raw)
                if not (0.0 <= score <= 1.0):
                    score = 1.0 / (1.0 + np.exp(-score))
                raw_dl = float(score)
            else:
                zero_bias = np.array([-1.1637, 5.0054], dtype=np.float32)
                calibrated_raw = (raw - zero_bias) / 12.0
                exp = np.exp(calibrated_raw - np.max(calibrated_raw))
                proba = exp / exp.sum()
                raw_dl = float(proba[1] if len(proba) > 1 else proba[0])

            ac_synth = self._compute_acoustic_synthetic_indicator(pcm)
            return float(np.clip(0.35 * raw_dl + 0.65 * ac_synth, 0.05, 0.95))

        except Exception as e:
            logger.error(f"[Engine] DL predict error: {e}")
            return self._heuristic_score(pcm)

    def _heuristic_score(self, pcm: np.ndarray) -> float:
        """
        Lightweight MFCC-variance heuristic used when models are absent.
        Synthetic speech tends to have lower MFCC variance and flatter spectrum.
        Returns a score in [0, 1] (higher = more likely fake).
        """
        if len(pcm) < 512:
            return 0.5
        try:
            mfcc = librosa.feature.mfcc(y=pcm, sr=TARGET_SR, n_mfcc=13)
            var  = np.mean(np.var(mfcc, axis=1))
            zcr  = np.mean(librosa.feature.zero_crossing_rate(pcm))
            # Low variance + high ZCR → synthetic tendency
            score = max(0.0, min(1.0, (1.0 - np.log1p(var) / 6.0) * 0.7 + zcr * 2.0))
            return float(score)
        except Exception:
            return 0.5

    # ── Public API ────────────────────────────────────────────────────

    def predict(self, pcm: np.ndarray) -> Tuple[float, float, float]:
        """
        Run full dual-stream inference.

        Returns:
            (ensemble_synth_score, ml_score, dl_score)
            All in [0.0, 1.0] where 1.0 = definitely fake.
        """
        ml_score = self._predict_ml(pcm)
        dl_score = self._predict_dl(pcm)
        ensemble = DL_WEIGHT * dl_score + ML_WEIGHT * ml_score
        logger.debug(f"[Engine] ml={ml_score:.3f} dl={dl_score:.3f} ensemble={ensemble:.3f}")
        return round(ensemble, 4), round(ml_score, 4), round(dl_score, 4)

    @property
    def ml_loaded(self) -> bool:
        return self._ml_model is not None

    @property
    def dl_loaded(self) -> bool:
        return self._ort_session is not None


# ── Module-level singleton ────────────────────────────────────────────
_engine: Optional[VoiceAnalysisEngine] = None


def get_engine() -> VoiceAnalysisEngine:
    global _engine
    if _engine is None:
        _engine = VoiceAnalysisEngine()
    return _engine
