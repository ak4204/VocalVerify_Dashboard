"""
plad_detector.py
================
PLAD — Prosodic Liveness & Artifact Detection

Computes four acoustic biomarkers that distinguish real human speech
from AI/TTS-generated audio, then combines them into a single
PLADScore (0.0 = definitely fake, 1.0 = definitely real/live).

Metrics
-------
1. Jitter        — cycle-to-cycle pitch period variation (real voices wobble naturally)
2. Shimmer       — cycle-to-cycle amplitude variation (TTS is too smooth)
3. Breath Energy — sub-100 Hz energy ratio (real speakers have breath noise)
4. Spectral Flux — frame-to-frame spectral change (TTS spectra are too stable)
"""

from __future__ import annotations

import numpy as np
import librosa
from dataclasses import dataclass, field
from typing import Optional
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

# ── Thresholds calibrated on deepfake-audio-detection dataset ──────────────
# Real speech tends to exceed these minimums; TTS tends to fall below them.
_THRESHOLDS = {
    "jitter_min":        0.005,   # < 0.5 % → suspiciously stable pitch
    "shimmer_min":       0.030,   # < 3.0 % → suspiciously uniform amplitude
    "breath_energy_min": 0.008,   # < 0.8 % sub-100 Hz energy → no breath noise
    "spectral_flux_min": 0.150,   # < 0.15 → spectrum barely changes between frames
}

# Weights for the ensemble PLADScore (must sum to 1.0)
_WEIGHTS = {
    "jitter":        0.30,
    "shimmer":       0.25,
    "breath_energy": 0.20,
    "spectral_flux": 0.25,
}


@dataclass
class PLADResult:
    """Container for all PLAD outputs."""

    # Raw biomarker values
    jitter:        float   # Relative Average Perturbation (RAP), dimensionless ratio
    shimmer:       float   # Amplitude Perturbation Quotient (APQ), dimensionless ratio
    breath_energy: float   # Ratio of sub-100 Hz RMS to total RMS
    spectral_flux: float   # Mean cosine-distance between consecutive magnitude spectra

    # Derived scores (0 = fake-leaning, 1 = real-leaning) per biomarker
    jitter_score:        float = field(default=0.0, repr=False)
    shimmer_score:       float = field(default=0.0, repr=False)
    breath_energy_score: float = field(default=0.0, repr=False)
    spectral_flux_score: float = field(default=0.0, repr=False)

    # Final ensemble
    plad_score: float = 0.0   # Weighted average of the four sub-scores
    verdict:    str   = ""    # Human-readable label

    def to_dict(self) -> dict:
        return {
            "jitter":              round(self.jitter, 6),
            "shimmer":             round(self.shimmer, 6),
            "breath_energy":       round(self.breath_energy, 6),
            "spectral_flux":       round(self.spectral_flux, 6),
            "jitter_score":        round(self.jitter_score, 4),
            "shimmer_score":       round(self.shimmer_score, 4),
            "breath_energy_score": round(self.breath_energy_score, 4),
            "spectral_flux_score": round(self.spectral_flux_score, 4),
            "plad_score":          round(self.plad_score, 4),
            "verdict":             self.verdict,
        }


class PLADDetector:
    """
    Prosodic Liveness & Artifact Detector.

    Parameters
    ----------
    target_sr : int
        All audio is resampled to this rate before analysis (16 kHz default).
    frame_length : int
        STFT / RMS frame length in samples.
    hop_length : int
        Hop between frames in samples.
    min_duration_sec : float
        Audio shorter than this is padded with silence before analysis.
    """

    def __init__(
        self,
        target_sr:        int   = 16_000,
        frame_length:     int   = 512,
        hop_length:       int   = 128,
        min_duration_sec: float = 1.0,
    ):
        self.target_sr        = target_sr
        self.frame_length     = frame_length
        self.hop_length       = hop_length
        self.min_duration_sec = min_duration_sec
        self._min_samples     = int(min_duration_sec * target_sr)

    # ── Public API ────────────────────────────────────────────────────────

    def analyze(self, filepath: str) -> PLADResult:
        """Load an audio file and run the full PLAD pipeline."""
        audio, sr = librosa.load(filepath, sr=self.target_sr, mono=True)
        return self._run(audio, sr)

    def analyze_array(self, audio: np.ndarray, sr: int) -> PLADResult:
        """Run PLAD on a pre-loaded numpy array."""
        if sr != self.target_sr:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.target_sr)
        return self._run(audio, self.target_sr)

    # ── Internal pipeline ─────────────────────────────────────────────────

    def _run(self, audio: np.ndarray, sr: int) -> PLADResult:
        audio = self._preprocess(audio)

        jitter        = self._compute_jitter(audio, sr)
        shimmer       = self._compute_shimmer(audio, sr)
        breath_energy = self._compute_breath_energy(audio, sr)
        spectral_flux = self._compute_spectral_flux(audio)

        # Convert raw values → sub-scores in [0, 1]
        j_score  = self._score_jitter(jitter)
        sh_score = self._score_shimmer(shimmer)
        br_score = self._score_breath_energy(breath_energy)
        sf_score = self._score_spectral_flux(spectral_flux)

        plad_score = (
            _WEIGHTS["jitter"]        * j_score  +
            _WEIGHTS["shimmer"]       * sh_score +
            _WEIGHTS["breath_energy"] * br_score +
            _WEIGHTS["spectral_flux"] * sf_score
        )
        plad_score = float(np.clip(plad_score, 0.0, 1.0))

        verdict = self._verdict(plad_score)

        return PLADResult(
            jitter=float(jitter),
            shimmer=float(shimmer),
            breath_energy=float(breath_energy),
            spectral_flux=float(spectral_flux),
            jitter_score=float(j_score),
            shimmer_score=float(sh_score),
            breath_energy_score=float(br_score),
            spectral_flux_score=float(sf_score),
            plad_score=plad_score,
            verdict=verdict,
        )

    # ── Pre-processing ────────────────────────────────────────────────────

    def _preprocess(self, audio: np.ndarray) -> np.ndarray:
        """Trim silence, normalise amplitude, pad if too short."""
        audio, _ = librosa.effects.trim(audio, top_db=30)

        if len(audio) < self._min_samples:
            audio = np.pad(audio, (0, self._min_samples - len(audio)))

        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak

        return audio

    # ── Biomarker 1: Jitter ───────────────────────────────────────────────

    def _compute_jitter(self, audio: np.ndarray, sr: int) -> float:
        """
        Relative Average Perturbation (RAP) jitter.
        """
        try:
            f0, voiced_flag, _ = librosa.pyin(
                audio,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
                sr=sr,
                frame_length=self.frame_length,
                hop_length=self.hop_length,
            )
            voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]
        except Exception:
            return 0.0

        if len(voiced_f0) < 4:
            return 0.0

        periods = 1.0 / voiced_f0
        n = len(periods)
        rap_sum = 0.0
        for i in range(1, n - 1):
            local_mean = (periods[i - 1] + periods[i] + periods[i + 1]) / 3.0
            rap_sum += abs(periods[i] - local_mean)

        mean_period = np.mean(periods)
        rap = (rap_sum / (n - 2)) / mean_period if mean_period > 0 else 0.0
        return float(rap)

    # ── Biomarker 2: Shimmer ──────────────────────────────────────────────

    def _compute_shimmer(self, audio: np.ndarray, sr: int) -> float:
        """
        Amplitude Perturbation Quotient (APQ-3) shimmer.
        """
        rms = librosa.feature.rms(
            y=audio, frame_length=self.frame_length, hop_length=self.hop_length
        )[0]

        rms_thresh = np.percentile(rms, 20)
        voiced_rms = rms[rms > rms_thresh]

        if len(voiced_rms) < 4:
            return 0.0

        n = len(voiced_rms)
        apq_sum = 0.0
        for i in range(1, n - 1):
            local_mean = (voiced_rms[i - 1] + voiced_rms[i] + voiced_rms[i + 1]) / 3.0
            apq_sum += abs(voiced_rms[i] - local_mean)

        mean_amp = np.mean(voiced_rms)
        apq = (apq_sum / (n - 2)) / mean_amp if mean_amp > 0 else 0.0
        return float(apq)

    # ── Biomarker 3: Breath Energy ────────────────────────────────────────

    def _compute_breath_energy(self, audio: np.ndarray, sr: int) -> float:
        """
        Sub-100 Hz energy ratio (breath / respiratory noise marker) across entire waveform.
        """
        from scipy.signal import butter, sosfilt
        try:
            sos = butter(4, 100.0, "lowpass", fs=sr, output="sos")
            audio_breath = sosfilt(sos, audio)
            rms_full   = np.sqrt(np.mean(audio ** 2)) + 1e-9
            rms_breath = np.sqrt(np.mean(audio_breath ** 2))
            ratio = rms_breath / rms_full
            return float(np.clip(ratio, 0.0, 1.0))
        except Exception:
            return 0.02

    # ── Biomarker 4: Spectral Flux ────────────────────────────────────────

    def _compute_spectral_flux(self, audio: np.ndarray) -> float:
        """
        Mean cosine distance between consecutive magnitude spectra.
        """
        S = np.abs(
            librosa.stft(audio, n_fft=self.frame_length * 4, hop_length=self.hop_length)
        )

        if S.shape[1] < 2:
            return 0.0

        S_T = S.T
        norms = np.linalg.norm(S_T, axis=1, keepdims=True) + 1e-9
        S_norm = S_T / norms

        dots = np.einsum("ij,ij->i", S_norm[:-1], S_norm[1:])
        flux_per_frame = 1.0 - dots
        mean_flux = float(np.mean(np.clip(flux_per_frame, 0.0, 1.0)))
        return mean_flux

    # ── Sub-score mapping ─────────────────────────────────────────────────

    @staticmethod
    def _sigmoid_score(value: float, low: float, high: float) -> float:
        if value <= low:
            return 0.0
        if value >= high:
            return 1.0
        return (value - low) / (high - low)

    def _score_jitter(self, jitter: float) -> float:
        return self._sigmoid_score(jitter, low=0.003, high=0.015)

    def _score_shimmer(self, shimmer: float) -> float:
        return self._sigmoid_score(shimmer, low=0.008, high=0.050)

    def _score_breath_energy(self, breath_energy: float) -> float:
        return self._sigmoid_score(breath_energy, low=0.008, high=0.050)

    def _score_spectral_flux(self, spectral_flux: float) -> float:
        return self._sigmoid_score(spectral_flux, low=0.005, high=0.025)

    # ── Verdict labels ────────────────────────────────────────────────────

    @staticmethod
    def _verdict(plad_score: float) -> str:
        if plad_score >= 0.75:
            return "LIKELY REAL"
        elif plad_score >= 0.50:
            return "UNCERTAIN — MANUAL REVIEW RECOMMENDED"
        elif plad_score >= 0.25:
            return "LIKELY SYNTHETIC"
        else:
            return "HIGHLY LIKELY SYNTHETIC / AI-GENERATED"


_default_detector: Optional[PLADDetector] = None

def get_plad_detector() -> PLADDetector:
    global _default_detector
    if _default_detector is None:
        _default_detector = PLADDetector()
    return _default_detector
