"""
similarity_engine.py
====================
Speaker Identity Similarity Engine

Extracts a 256-dim speaker embedding from an audio clip using a hand-rolled
d-vector approach (MFCC + delta statistics, projected through a learned-style
whitening layer) and computes cosine similarity between two speakers.
"""

from __future__ import annotations

import numpy as np
import librosa
from dataclasses import dataclass, field
from typing import Optional, Tuple, List

_THRESHOLDS = {
    "strong_match":  0.82,   # cosine sim >= 0.82 -> strong same-speaker evidence
    "likely_match":  0.65,   # cosine sim >= 0.65 -> probable same speaker
    "uncertain":     0.45,   # cosine sim >= 0.45 -> uncertain
}


@dataclass
class SimilarityResult:
    """Container for speaker comparison output."""

    cosine_similarity: float   # Raw cosine similarity in [-1, 1]
    match_pct:         float   # Rescaled to [0, 100] for UI display
    same_speaker:      bool    # Hard decision (True / False)
    verdict:           str     # Human-readable label
    embedding_dim:     int = 256
    reference_scores:  List[float] = field(default_factory=list)  # [S1, S2, S3]
    centroid_score:    float = 0.0                                 # Centroid match %

    def to_dict(self) -> dict:
        return {
            "cosine_similarity": round(self.cosine_similarity, 4),
            "match_pct":         round(self.match_pct, 2),
            "same_speaker":      self.same_speaker,
            "verdict":           self.verdict,
            "embedding_dim":     self.embedding_dim,
            "reference_scores":  [round(s, 2) for s in self.reference_scores],
            "centroid_score":    round(self.centroid_score, 2),
        }


class SimilarityEngine:
    """
    Speaker identity verification via d-vector style embeddings.
    """

    def __init__(
        self,
        target_sr:   int   = 16_000,
        segment_sec: float = 3.0,
        n_mfcc:      int   = 40,
    ):
        self.target_sr   = target_sr
        self.segment_sec = segment_sec
        self.n_mfcc      = n_mfcc
        self._seg_len     = int(segment_sec * target_sr)

        rng = np.random.default_rng(seed=42)
        raw_dim = (n_mfcc * 4) + 8 + (12 * 2) + (6 * 2) + 10  # = 214
        self._proj = rng.standard_normal((raw_dim, 256)).astype(np.float32)
        self._proj, _ = np.linalg.qr(self._proj)

    # ── Public API ────────────────────────────────────────────────────────────

    def compare_files(
        self,
        test_path:      str,
        reference_path: str,
    ) -> SimilarityResult:
        """Load two audio files and compute speaker similarity."""
        test_audio,  sr1 = librosa.load(test_path,      sr=self.target_sr, mono=True)
        ref_audio,   sr2 = librosa.load(reference_path, sr=self.target_sr, mono=True)
        return self._compare(test_audio, self.target_sr, ref_audio, self.target_sr)

    def compare_arrays(
        self,
        test_audio:  np.ndarray,
        test_sr:     int,
        ref_audio:   np.ndarray,
        ref_sr:      int,
    ) -> SimilarityResult:
        """Compare two pre-loaded numpy arrays."""
        if test_sr != self.target_sr:
            test_audio = librosa.resample(test_audio, orig_sr=test_sr, target_sr=self.target_sr)
        if ref_sr != self.target_sr:
            ref_audio = librosa.resample(ref_audio, orig_sr=ref_sr, target_sr=self.target_sr)
        return self._compare(test_audio, self.target_sr, ref_audio, self.target_sr)

    def compare_multi_arrays(
        self,
        test_audio: np.ndarray,
        test_sr:    int,
        ref_audios: List[np.ndarray],
        ref_sr:     int,
    ) -> SimilarityResult:
        """
        Multi-Reference Speaker Verification:
        1. Extract speaker embeddings [E1, E2, E3] for all samples.
        2. Compute Centroid Vector: Centroid = (E1 + E2 + E3) / 3 (L2 normalized).
        3. Compute individual cosine similarities [S1, S2, S3] and Centroid similarity.
        4. Return aggregated match percentage with individual sample breakdown.
        """
        if not ref_audios:
            return SimilarityResult(
                cosine_similarity=0.0,
                match_pct=0.0,
                same_speaker=False,
                verdict="NO REFERENCE SAMPLES",
                embedding_dim=256,
                reference_scores=[],
                centroid_score=0.0
            )

        if test_sr != self.target_sr:
            test_audio = librosa.resample(test_audio, orig_sr=test_sr, target_sr=self.target_sr)

        test_audio_prep = self._preprocess(test_audio)
        emb_test = self._embed(test_audio_prep)

        # 1. Extract embeddings for all reference samples
        ref_embeddings = []
        individual_scores = []

        for ref_pcm in ref_audios:
            if len(ref_pcm) < 1000:
                continue
            if ref_sr != self.target_sr:
                ref_pcm = librosa.resample(ref_pcm, orig_sr=ref_sr, target_sr=self.target_sr)
            ref_prep = self._preprocess(ref_pcm)
            emb_r = self._embed(ref_prep)
            ref_embeddings.append(emb_r)

            s_i = float(np.clip(np.dot(emb_test, emb_r), -1.0, 1.0))
            individual_scores.append(round(float(np.clip(s_i * 100.0, 0.0, 100.0)), 2))

        if not ref_embeddings:
            return SimilarityResult(
                cosine_similarity=0.0,
                match_pct=0.0,
                same_speaker=False,
                verdict="INVALID REFERENCE SAMPLES",
                embedding_dim=256,
                reference_scores=[],
                centroid_score=0.0
            )

        # 2. Centroid Vector Aggregation: Centroid = mean(E_1, E_2, ...)
        centroid = np.mean(ref_embeddings, axis=0)
        norm = np.linalg.norm(centroid) + 1e-9
        centroid = centroid / norm

        # 3. Cosine Similarity against Centroid
        centroid_cos = float(np.clip(np.dot(emb_test, centroid), -1.0, 1.0))
        centroid_pct = round(float(np.clip(centroid_cos * 100.0, 0.0, 100.0)), 2)

        # Aggregated score: average of centroid similarity and mean of individual scores
        mean_individual = float(np.mean(individual_scores)) if individual_scores else centroid_pct
        aggregated_pct = round(0.5 * centroid_pct + 0.5 * mean_individual, 2)

        match_pct, same_speaker, verdict = self._decide(centroid_cos)

        return SimilarityResult(
            cosine_similarity=centroid_cos,
            match_pct=aggregated_pct,
            same_speaker=same_speaker,
            verdict=verdict,
            embedding_dim=256,
            reference_scores=individual_scores,
            centroid_score=centroid_pct,
        )

    def get_embedding(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """
        Return the 256-dim L2-normalised speaker embedding for a single clip.
        """
        if sr != self.target_sr:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.target_sr)
        audio = self._preprocess(audio)
        return self._embed(audio)

    # ── Internal pipeline ─────────────────────────────────────────────────────

    def _compare(
        self,
        test_audio: np.ndarray,
        test_sr:    int,
        ref_audio:  np.ndarray,
        ref_sr:     int,
    ) -> SimilarityResult:
        test_audio = self._preprocess(test_audio)
        ref_audio  = self._preprocess(ref_audio)

        emb_test = self._embed(test_audio)
        emb_ref  = self._embed(ref_audio)

        cosine_sim = float(np.dot(emb_test, emb_ref))
        cosine_sim = float(np.clip(cosine_sim, -1.0, 1.0))

        match_pct, same_speaker, verdict = self._decide(cosine_sim)

        return SimilarityResult(
            cosine_similarity=cosine_sim,
            match_pct=match_pct,
            same_speaker=same_speaker,
            verdict=verdict,
            embedding_dim=256,
        )

    # ── Pre-processing ────────────────────────────────────────────────────────

    def _preprocess(self, audio: np.ndarray) -> np.ndarray:
        """Trim silence -> fix segment length -> peak-normalise."""
        audio, _ = librosa.effects.trim(audio, top_db=30)

        if len(audio) < self._seg_len:
            audio = np.pad(audio, (0, self._seg_len - len(audio)))
        else:
            start = (len(audio) - self._seg_len) // 2
            audio = audio[start: start + self._seg_len]

        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak

        return audio

    # ── Feature extraction -> embedding ────────────────────────────────────────

    def _embed(self, audio: np.ndarray) -> np.ndarray:
        sr = self.target_sr

        # 1. MFCCs (40 coefficients x mean + std = 80 dims)
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=self.n_mfcc)
        mfcc_feat = np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)])

        # 2. MFCC deltas (40 x mean + std = 80 dims)
        mfcc_d = librosa.feature.delta(mfcc)
        mfcc_d_feat = np.concatenate([mfcc_d.mean(axis=1), mfcc_d.std(axis=1)])

        # 3. Spectral contrast (7 bands + 1 valley = 8 dims mean only)
        try:
            contrast = librosa.feature.spectral_contrast(y=audio, sr=sr)
            contrast_feat = contrast.mean(axis=1)
        except Exception:
            contrast_feat = np.zeros(7, dtype=np.float32)

        # 4. Chroma CQT (12 bins x mean + std = 24 dims)
        try:
            chroma = librosa.feature.chroma_cqt(y=audio, sr=sr)
            chroma_feat = np.concatenate([chroma.mean(axis=1), chroma.std(axis=1)])
        except Exception:
            chroma_feat = np.zeros(24, dtype=np.float32)

        # 5. Tonnetz (6 x mean + std = 12 dims)
        try:
            tonnetz = librosa.feature.tonnetz(y=audio, sr=sr)
            tonnetz_feat = np.concatenate([tonnetz.mean(axis=1), tonnetz.std(axis=1)])
        except Exception:
            tonnetz_feat = np.zeros(12, dtype=np.float32)

        # 6. Low-level descriptors (5 x mean + std = 10 dims)
        rms      = librosa.feature.rms(y=audio)
        zcr      = librosa.feature.zero_crossing_rate(y=audio)
        cent     = librosa.feature.spectral_centroid(y=audio, sr=sr)
        bw       = librosa.feature.spectral_bandwidth(y=audio, sr=sr)
        rolloff  = librosa.feature.spectral_rolloff(y=audio, sr=sr)

        scalar_feats = np.array([
            rms.mean(),    rms.std(),
            zcr.mean(),    zcr.std(),
            cent.mean(),   cent.std(),
            bw.mean(),     bw.std(),
            rolloff.mean(), rolloff.std(),
        ])

        raw = np.concatenate([
            mfcc_feat,
            mfcc_d_feat,
            contrast_feat,
            chroma_feat,
            tonnetz_feat,
            scalar_feats,
        ]).astype(np.float32)

        proj_in = self._proj.shape[0]
        if len(raw) < proj_in:
            raw = np.pad(raw, (0, proj_in - len(raw)))
        else:
            raw = raw[:proj_in]

        embedding = raw @ self._proj
        norm = np.linalg.norm(embedding) + 1e-9
        embedding = embedding / norm

        return embedding.astype(np.float32)

    # ── Decision logic ────────────────────────────────────────────────────────

    @staticmethod
    def _decide(cosine_sim: float) -> Tuple[float, bool, str]:
        match_pct = float(np.clip(cosine_sim * 100.0, 0.0, 100.0))

        if cosine_sim >= _THRESHOLDS["strong_match"]:
            return match_pct, True,  "STRONG MATCH — HIGH CONFIDENCE SAME SPEAKER"
        elif cosine_sim >= _THRESHOLDS["likely_match"]:
            return match_pct, True,  "LIKELY SAME SPEAKER"
        elif cosine_sim >= _THRESHOLDS["uncertain"]:
            return match_pct, False, "UNCERTAIN — MANUAL REVIEW RECOMMENDED"
        else:
            return match_pct, False, "LIKELY DIFFERENT SPEAKER"


_default_similarity_engine: Optional[SimilarityEngine] = None

def get_similarity_engine() -> SimilarityEngine:
    global _default_similarity_engine
    if _default_similarity_engine is None:
        _default_similarity_engine = SimilarityEngine()
    return _default_similarity_engine
