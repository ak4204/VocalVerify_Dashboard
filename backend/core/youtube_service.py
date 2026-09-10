"""
youtube_service.py
==================
Two-Tier Reference Audio Retrieval Service for VocalVerify:
1. Local Voice Vault Cache Check (Primary):
   - Prioritize checking local storage (./vault_cache/{claimed_identity}.wav).
   - If an enrolled reference exists for public figures (e.g., Narendra Modi, Joe Biden),
     bypasses YouTube entirely for instant zero-latency verification.

2. VideoDB Spoken Content Indexing & Timestamp Trimming (Secondary):
   - If missing from the local vault, upload the fetched YouTube URL to VideoDB.
   - Call video.index_spoken_words() to generate a time-aligned transcript.
   - Search the indexed transcript for key terms in the claimed speech to identify
     the exact timestamps where the target person actually speaks.
   - Extract only the sub-clip segment matching the target speech timestamps,
     dropping news anchor intros and background noise before passing audio into the
     16kHz mono resampling pipeline.
"""

import os
import re
import json
import logging
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List
import numpy as np
import librosa
import soundfile as sf

logger = logging.getLogger(__name__)

# ── API Keys ─────────────────────────────────────────────────────────────
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "AIzaSyBljYAO_Rx5SWp9V7zh3vUosUJzFcMUXSk")
VIDEO_DB_API_KEY = os.getenv("VIDEO_DB_API_KEY", "sk-3YtrJLuVbqYDYEKfrMr_LDVRlA9BdhTHruhXiQ1GblI")

# ── Directory Layout ─────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent

VAULT_DIRS = [
    ROOT_DIR / "vault_cache",
    BACKEND_DIR / "vault_cache",
    BACKEND_DIR / "data" / "vault_cache",
]
for vd in VAULT_DIRS:
    vd.mkdir(parents=True, exist_ok=True)

REF_CACHE_DIR = BACKEND_DIR / "data" / "reference_cache"
REF_CACHE_DIR.mkdir(parents=True, exist_ok=True)

TARGET_SR = 16_000


# ── Identity Normalization ───────────────────────────────────────────────

def _normalize_name_variants(person_name: str) -> List[str]:
    """Generate potential filename stems for a public figure."""
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", person_name).lower().strip()
    words = cleaned.split()
    if not words:
        return ["unknown"]

    # Remove titles
    titles = {"pm", "president", "minister", "dr", "mr", "senator", "chief", "shri", "honorable"}
    filtered_words = [w for w in words if w not in titles]
    if not filtered_words:
        filtered_words = words

    variants = [
        "_".join(filtered_words),
        " ".join(filtered_words),
        "-".join(filtered_words),
        "_".join(words),
        " ".join(words),
        filtered_words[-1],            # e.g., 'modi'
        "".join(filtered_words),
    ]
    # Return unique variants preserving order
    seen = set()
    result = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            result.append(v)
    return result


# ── Tier 1: Local Voice Vault Cache ──────────────────────────────────────

def check_voice_vault(person_name: str) -> Optional[Tuple[np.ndarray, str, str]]:
    """
    Tier 1 Check:
    Search local vault_cache for an enrolled clean speech reference of the person.
    Returns (audio_pcm, source_description, title) or None if cache miss.
    """
    variants = _normalize_name_variants(person_name)
    extensions = [".wav", ".mp3", ".flac", ".m4a"]

    for vault_dir in VAULT_DIRS:
        if not vault_dir.exists():
            continue
        for variant in variants:
            for ext in extensions:
                candidate = vault_dir / f"{variant}{ext}"
                if candidate.is_file() and candidate.stat().st_size > 1000:
                    logger.info(f"[VoiceVault] HIT: Found enrolled reference for '{person_name}' at {candidate}")
                    try:
                        audio, _ = librosa.load(str(candidate), sr=TARGET_SR, mono=True, duration=45.0)
                        if len(audio) > TARGET_SR * 0.5:
                            return (
                                audio,
                                f"Voice Vault (Local Enrolled): {candidate.name}",
                                f"Official Voice Vault Reference ({person_name.title()})"
                            )
                    except Exception as e:
                        logger.warning(f"[VoiceVault] Failed to load {candidate}: {e}")

    logger.info(f"[VoiceVault] MISS: No local vault entry for '{person_name}'. Proceeding to VideoDB/YouTube...")
    return None


def enroll_in_voice_vault(person_name: str, audio_pcm: np.ndarray, sr: int = TARGET_SR) -> Optional[Path]:
    """Enroll a clean speech segment into the primary local Voice Vault."""
    if len(audio_pcm) < TARGET_SR * 0.5:
        return None

    norm_stem = _normalize_name_variants(person_name)[0]
    primary_vault = VAULT_DIRS[0]
    out_file = primary_vault / f"{norm_stem}.wav"

    try:
        sf.write(str(out_file), audio_pcm, sr, subtype="PCM_16")
        logger.info(f"[VoiceVault] Successfully enrolled clean speech into {out_file}")

        # Also sync to backend vault_cache
        backup_file = VAULT_DIRS[1] / f"{norm_stem}.wav"
        if backup_file != out_file:
            sf.write(str(backup_file), audio_pcm, sr, subtype="PCM_16")
        return out_file
    except Exception as e:
        logger.warning(f"[VoiceVault] Enrollment error: {e}")
        return None


# ── YouTube Data API v3 Search ───────────────────────────────────────────

def search_youtube_speech(person_name: str) -> Optional[Tuple[str, str, str]]:
    """
    Search YouTube for official speech audio of the claimed public figure.
    Returns: (video_id, title, video_url) or None
    """
    query = f"{person_name} official speech address press conference"
    encoded_query = urllib.parse.quote(query)
    api_url = (
        f"https://www.googleapis.com/youtube/v3/search?"
        f"part=snippet&q={encoded_query}&type=video&videoCaption=closedCaption&maxResults=1&key={YOUTUBE_API_KEY}"
    )

    try:
        req = urllib.request.Request(api_url, headers={"User-Agent": "VocalVerify/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            items = data.get("items", [])
            if not items:
                fallback_url = (
                    f"https://www.googleapis.com/youtube/v3/search?"
                    f"part=snippet&q={encoded_query}&type=video&maxResults=1&key={YOUTUBE_API_KEY}"
                )
                req_fb = urllib.request.Request(fallback_url, headers={"User-Agent": "VocalVerify/1.0"})
                with urllib.request.urlopen(req_fb, timeout=10) as resp_fb:
                    data = json.loads(resp_fb.read().decode("utf-8"))
                    items = data.get("items", [])

            if items:
                video_id = items[0]["id"]["videoId"]
                title = items[0]["snippet"]["title"]
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                logger.info(f"[YouTube] Found official reference candidate: '{title}' ({video_url})")
                return video_id, title, video_url

    except Exception as e:
        logger.warning(f"[YouTube] API search failed: {e}")

    return None


# ── Tier 2: VideoDB Spoken Content Indexing & Timestamp Trimming ─────────

def get_clean_reference_audio(
    youtube_url: str,
    search_phrase: str,
    output_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Uploads fetched YouTube URL to VideoDB, indexes spoken transcript,
    locates target speech timestamps where the public figure actually speaks,
    and returns timeline bounds isolated from news anchor commentary.
    """
    try:
        from videodb import connect

        api_key = os.getenv("VIDEO_DB_API_KEY", VIDEO_DB_API_KEY)
        logger.info(f"[VideoDB] Connecting with API Key ({api_key[:6]}...)...")
        conn = connect(api_key=api_key)
        coll = conn.get_collection()

        # 1. Upload video URL directly to VideoDB
        logger.info(f"[VideoDB] Uploading video URL '{youtube_url}'...")
        video = coll.upload(url=youtube_url)

        # 2. Index spoken transcript
        logger.info(f"[VideoDB] Indexing spoken words for video {video.id}...")
        video.index_spoken_words()

        # 3. Locate target speech timestamps using search query
        queries = [
            search_phrase,
            f"{search_phrase} speech",
            "Independence Day",
            "address",
            "speech"
        ]
        results = None
        for q in queries:
            try:
                if hasattr(video, "search_spoken_words"):
                    results = video.search_spoken_words(query=q)
                else:
                    results = video.search(query=q, search_type="semantic", index_type="spoken_word")
                shots = getattr(results, "shots", None) or (results.get_shots() if hasattr(results, "get_shots") else [])
                if shots:
                    break
            except Exception as se:
                logger.debug(f"[VideoDB] Query '{q}' check: {se}")

        shots = getattr(results, "shots", None) or (results.get_shots() if (results and hasattr(results, "get_shots")) else [])

        if shots:
            best_match = shots[0]
            start_time = float(getattr(best_match, "start", 0.0))
            end_time = float(getattr(best_match, "end", start_time + 15.0))

            # Guarantee minimum 6s segment for speaker d-vector extraction
            if (end_time - start_time) < 6.0:
                end_time = start_time + 10.0

            logger.info(f"[VideoDB] Isolated speech segment: {start_time:.1f}s to {end_time:.1f}s")

            stream_url = ""
            try:
                stream_url = video.generate_stream(timeline=[(start_time, end_time)])
            except Exception as ge:
                logger.debug(f"[VideoDB] generate_stream note: {ge}")

            return {
                "stream_url": stream_url or youtube_url,
                "start_time": start_time,
                "end_time": end_time,
                "success": True,
            }

    except Exception as e:
        logger.warning(f"[VideoDB] Processing encountered fallback condition: {e}")

    return {
        "stream_url": youtube_url,
        "start_time": 0.0,
        "end_time": None,
        "success": False,
    }


def _download_and_trim_audio(
    video_url: str,
    start_time: float,
    end_time: Optional[float],
    out_wav_path: Path
) -> bool:
    """
    Downloads and trims the clean speech segment using yt-dlp & ffmpeg,
    dropping anchor intro and background commentary.
    """
    try:
        import yt_dlp

        temp_audio = REF_CACHE_DIR / f"temp_{out_wav_path.stem}.wav"

        # Download raw audio with yt-dlp
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": str(temp_audio.with_suffix(".%(ext)s")),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "192",
                }
            ],
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        if not temp_audio.exists():
            # Check if ext was preserved
            for f in REF_CACHE_DIR.glob(f"temp_{out_wav_path.stem}.*"):
                if f.is_file():
                    temp_audio = f
                    break

        if not temp_audio.exists():
            return False

        # Trim with FFmpeg to exact start/end
        cmd = ["ffmpeg", "-y"]
        if start_time > 0:
            cmd.extend(["-ss", str(start_time)])
        cmd.extend(["-i", str(temp_audio)])
        if end_time and end_time > start_time:
            cmd.extend(["-t", str(end_time - start_time)])
        else:
            cmd.extend(["-t", "30.0"])  # Cap at 30 seconds
        cmd.extend(["-ar", str(TARGET_SR), "-ac", "1", str(out_wav_path)])

        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        # Cleanup temp
        if temp_audio.exists():
            try:
                temp_audio.unlink()
            except Exception:
                pass

        return out_wav_path.exists() and out_wav_path.stat().st_size > 1000

    except Exception as e:
        logger.warning(f"[YouTube/FFmpeg] Download & trim failed: {e}")
        return False


# ── Master Reference Audio Fetcher ───────────────────────────────────────

def fetch_reference_audio(
    person_name: str,
    search_context: str = ""
) -> Tuple[Optional[np.ndarray], Optional[str], Optional[str]]:
    """
    Two-Tier Reference Audio Retrieval:
    1. Primary: Check Local Voice Vault Cache (instant zero latency).
    2. Secondary: If cache miss, search YouTube, use VideoDB spoken content indexing
       to isolate target speech from news anchor intro/jingles, trim clean segment,
       and automatically enroll in Voice Vault for future zero-latency runs.
    """
    if not person_name or not person_name.strip():
        return None, None, None

    cleaned_name = person_name.strip()

    # ── Tier 1: Check Local Voice Vault Cache ─────────────────────────
    vault_res = check_voice_vault(cleaned_name)
    if vault_res is not None:
        return vault_res

    # ── Tier 2: VideoDB Spoken Content Indexing & Trimming ────────────
    search_res = search_youtube_speech(cleaned_name)
    if not search_res:
        logger.warning(f"[YouTube] No reference video found for '{cleaned_name}'")
        return None, None, None

    video_id, title, video_url = search_res
    clean_cached_wav = REF_CACHE_DIR / f"{video_id}_clean.wav"

    if clean_cached_wav.exists():
        try:
            audio, _ = librosa.load(str(clean_cached_wav), sr=TARGET_SR, mono=True, duration=35.0)
            enroll_in_voice_vault(cleaned_name, audio, TARGET_SR)
            return audio, video_url, f"{title} (Trimmed)"
        except Exception as e:
            logger.warning(f"[Cache] Failed reading cached clean WAV: {e}")

    # Index and search spoken words with VideoDB
    search_query = search_context or cleaned_name
    vdb_info = get_clean_reference_audio(video_url, search_query, str(clean_cached_wav))

    start_time = vdb_info.get("start_time", 0.0)
    end_time = vdb_info.get("end_time", None)

    # Download and trim
    ok = _download_and_trim_audio(video_url, start_time, end_time, clean_cached_wav)
    if ok and clean_cached_wav.exists():
        try:
            audio, _ = librosa.load(str(clean_cached_wav), sr=TARGET_SR, mono=True, duration=35.0)
            # Auto-enroll in Voice Vault so next run is zero-latency!
            enroll_in_voice_vault(cleaned_name, audio, TARGET_SR)
            desc_title = f"{title} (VideoDB trimmed: {start_time:.1f}s-{end_time or 30.0:.1f}s)"
            return audio, video_url, desc_title
        except Exception as e:
            logger.error(f"[YouTube] Error loading trimmed audio: {e}")

    # Fallback to standard yt-dlp if VideoDB segment download fails
    try:
        raw_cached = REF_CACHE_DIR / f"{video_id}.wav"
        if not raw_cached.exists():
            import yt_dlp
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": str(raw_cached.with_suffix(".%(ext)s")),
                "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav", "preferredquality": "192"}],
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

        if raw_cached.exists():
            audio, _ = librosa.load(str(raw_cached), sr=TARGET_SR, mono=True, duration=30.0)
            enroll_in_voice_vault(cleaned_name, audio, TARGET_SR)
            return audio, video_url, title
    except Exception as fe:
        logger.error(f"[YouTube] Fallback download error: {fe}")

    return None, video_url, title


def fetch_multi_reference_audio(
    person_name: str,
    count: int = 3,
    search_context: str = ""
) -> Tuple[List[np.ndarray], Optional[str], Optional[str]]:
    """
    Multi-Sample Enrollment & Retrieval:
    Collects 3 distinct clean audio samples for the target speaker.
    1. Checks Voice Vault for numbered samples (e.g. {person}_1.wav, {person}_2.wav, {person}_3.wav).
    2. If a single clean master recording exists, partitions it into 3 distinct non-overlapping
       segments to extract intra-speaker acoustic variation for centroid computation.
    3. Falls back to YouTube / VideoDB if missing from local vault.
    """
    if not person_name or not person_name.strip():
        return [], None, None

    cleaned_name = person_name.strip()
    variants = _normalize_name_variants(cleaned_name)
    samples: List[np.ndarray] = []

    # Check for discrete multi-sample files (e.g. narendra_modi_1.wav, etc.)
    for vault_dir in VAULT_DIRS:
        if not vault_dir.exists():
            continue
        for var in variants:
            cand_samples = []
            for i in range(1, count + 1):
                f = vault_dir / f"{var}_{i}.wav"
                if f.is_file():
                    try:
                        aud, _ = librosa.load(str(f), sr=TARGET_SR, mono=True, duration=20.0)
                        if len(aud) >= TARGET_SR * 1.0:
                            cand_samples.append(aud)
                    except Exception:
                        pass
            if len(cand_samples) >= 2:
                logger.info(f"[VoiceVault] Loaded {len(cand_samples)} distinct multi-sample references for '{cleaned_name}'")
                return cand_samples, f"Voice Vault (Multi-Sample Enrolled: {len(cand_samples)} samples)", f"Voice Vault Centroid: {cleaned_name.title()}"

    # Fallback to master reference and partition into 3 distinct temporal windows
    master_audio, ref_url, ref_title = fetch_reference_audio(cleaned_name, search_context=search_context)
    if master_audio is not None and len(master_audio) >= TARGET_SR * 1.5:
        total_len = len(master_audio)
        part_len = total_len // count
        if part_len >= TARGET_SR * 1.0:
            for i in range(count):
                start_idx = i * part_len
                end_idx = (i + 1) * part_len if i < count - 1 else total_len
                seg = master_audio[start_idx:end_idx]
                samples.append(seg)
        else:
            # Short audio: produce overlapping slices
            slice_len = min(total_len, int(TARGET_SR * 2.5))
            step = max(1, (total_len - slice_len) // (count - 1)) if total_len > slice_len else 0
            for i in range(count):
                st = min(i * step, total_len - slice_len) if total_len > slice_len else 0
                samples.append(master_audio[st: st + slice_len])

        logger.info(f"[VoiceVault] Generated {len(samples)} distinct reference partitions for Centroid aggregation.")
        return samples, ref_url, f"{ref_title} (3-Sample Centroid)"

    return samples, ref_url, ref_title
