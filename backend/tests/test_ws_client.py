"""
test_ws_client.py
──────────────────
Simulates the Android overlay sending PCM-16 audio frames every 1.5 seconds.
Usage:
    python tests/test_ws_client.py [path/to/audio.wav]
If no file is provided it sends synthetic sine-wave data.
"""
import asyncio
import base64
import json
import sys
import time
import numpy as np
import websockets

WS_URL = "ws://localhost:8000/ws/telephony/test_device_001"
SESSION_ID = f"test_sess_{int(time.time())}"
TARGET_SR = 16_000
CHUNK_SECONDS = 1.5
CHUNK_SAMPLES = int(TARGET_SR * CHUNK_SECONDS)


def load_audio(path: str) -> np.ndarray:
    import librosa
    pcm, _ = librosa.load(path, sr=TARGET_SR, mono=True)
    return (pcm * 32768).astype(np.int16)


def generate_sine_chunk(freq: float = 440.0) -> np.ndarray:
    t = np.linspace(0, CHUNK_SECONDS, CHUNK_SAMPLES)
    return (np.sin(2 * np.pi * freq * t) * 16000).astype(np.int16)


def make_payload(chunk_int16: np.ndarray) -> str:
    b64 = base64.b64encode(chunk_int16.tobytes()).decode()
    return json.dumps({
        "session_id": SESSION_ID,
        "device_id": "test_device_001",
        "target_profile_id": "cfo_sarah_jenkins",
        "telecom_metadata": {
            "caller_number": "+919876543210",
            "call_direction": "INBOUND",
            "codec": "AMR-WB",
            "timestamp": int(time.time()),
        },
        "audio_payload": {
            "sample_rate": TARGET_SR,
            "encoding": "PCM_16BIT",
            "audio_bytes_base64": b64,
        }
    })


async def run():
    print(f"Connecting to {WS_URL} …")
    async with websockets.connect(WS_URL) as ws:
        print("Connected. Streaming audio chunks…\n")

        if len(sys.argv) > 1:
            samples = load_audio(sys.argv[1])
            chunks = [samples[i:i+CHUNK_SAMPLES] for i in range(0, len(samples), CHUNK_SAMPLES)]
        else:
            chunks = [generate_sine_chunk(freq) for freq in [440, 880, 220, 1200, 660]]

        for i, chunk in enumerate(chunks):
            if len(chunk) < CHUNK_SAMPLES:
                chunk = np.pad(chunk, (0, CHUNK_SAMPLES - len(chunk)))
            payload = make_payload(chunk)
            await ws.send(payload)
            response = await ws.recv()
            verdict = json.loads(response)
            print(f"Frame {i+1:02d} → outcomeCode={verdict.get('outcomeCode'):<18} "
                  f"synth={verdict.get('syntheticScore', 0):.3f}  "
                  f"ml={verdict.get('mlScore', 0):.3f}  "
                  f"dl={verdict.get('dlScore', 0):.3f}  "
                  f"conf={verdict.get('confidence', 0):.3f}")
            await asyncio.sleep(1.5)

    print("\nDone. Session closed.")


if __name__ == "__main__":
    asyncio.run(run())
