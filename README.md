---
title: VocalVerify - Real-Time Voice Clone & Impersonation Defense
emoji: 🛡️
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
---

# 🛡️ VocalVerify: Real-Time Voice Clone & Impersonation Defense

**VocalVerify** is an end-to-end, multi-modal voice intelligence system designed to detect AI-generated voice clones, deepfake audio, and executive vishing in real-time during live cellular and VoIP calls.

Equipped with an Android companion overlay and a live analytical dashboard, VocalVerify delivers sub-50ms inference across dual AI streams and physiological vocal biomarker analysis.

---

## 🚀 Architectural Breakthroughs

```
                          [ Android Call Guard Companion ]
                           │  • Edge VAD (Silence Pruning)
                           │  • Accessibility Audio Bypass
                           │  • Floating Security HUD
                           │ (WSS 16kHz PCM-16 Chunks)
                           ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │  VocalVerify Backend Engine & Live Dashboard                           │
    │                                                                        │
    │   Nginx Reverse Proxy / Cloud Router                                  │
    │   ├── /ws/telephony/{device_id} ──► FastAPI WebSocket Engine (:8080)   │
    │   ├── /ws/dashboard             ──► Dashboard Live Event Stream        │
    │   ├── /api/v1/                  ──► REST Forensics & Verification APIs │
    │   └── /                         ──► Next.js Analytics Dashboard (:3000)│
    │                                                                        │
    │   Multi-Stage Inference Pipeline:                                      │
    │   ├── 1. Self-Voice Filter: ECAPA-TDNN drops user's own speech        │
    │   ├── 2. PLAD Biomarkers: Jitter RAP, Shimmer APQ3, Breath Energy      │
    │   ├── 3. Acoustic Stream: 55-Feature MFCC & Spectral XGBoost Model     │
    │   ├── 4. Deep Learning Stream: Wav2Vec 2.0 + ResNet ONNX Neural Net   │
    │   └── 5. Voice Vault Centroid: Cosine similarity identity matching     │
    └────────────────────────────────────────────────────────────────────────┘
```

### 1. Edge Voice Activity Detection (Silence & Noise Filter)
Rather than blindly uploading continuous audio, the Android capture layer performs real-time micro-amplitude parsing on-device. Dead air, line pauses, and background room hum are discarded before transmission. This reduces network payload by **>60%** and guarantees the backend models only evaluate actual human speech.

### 2. In-Call Audio Pipeline (Accessibility Architecture)
Modern mobile operating systems strictly sandbox the microphone during active cellular calls. VocalVerify implements an Android Accessibility service combined with `AudioSource.VOICE_RECOGNITION`. This unblocks the audio hardware stream during live calls without triggering aggressive echo-cancellation, allowing caller audio to be captured reliably in real-time.

### 3. Self-Voice Discrimination (Speaker Isolation)
When the user speaks into their own phone, their voice enters the microphone alongside the remote caller. VocalVerify incorporates an **ECAPA-TDNN** neural embedding filter on incoming audio frames to identify and drop the device owner's voice, ensuring forensic scores reflect only the caller.

### 4. Dual-Stream Multi-Model Ensemble
- **Acoustic ML Stream (XGBoost):** Extracts 55 spectral features (13 MFCCs with delta/delta-delta statistics, spectral centroid, rolloff, zero-crossing rate, chroma) to detect vocoder artifacts.
- **Deep Learning Stream (Wav2Vec 2.0 + ResNet ONNX):** Analyzes raw 16 kHz waveforms for latent temporal synthetic anomalies.
- **Physical Liveness (PLAD):** Gauges involuntary vocal tract micro-tremors (acoustic jitter, shimmer, and breathiness) that text-to-speech engines struggle to reproduce.
- **Voice Vault Matching:** Compares incoming acoustic embeddings against enrolled voiceprints (e.g. executives, institutional contacts) via centroid cosine similarity.

### 5. Web Audio Live Monitor with Dynamic Compression
The Next.js dashboard features an integrated real-time audio monitor powered by the browser's Web Audio API. It includes a multi-stage **Dynamics Compressor** with a **300% software gain boost** to clearly project low-volume caller audio alongside a real-time RMS/peak level visualizer.

---

## 📱 Android Mobile Call Guard App

The mobile companion app runs as an unobtrusive background security guard:
1. **Incoming / Outgoing Call Detection:** Monitors telephony states and automatically initializes the audio stream upon call connection.
2. **Floating Security HUD:** Displays a non-intrusive floating overlay showing live threat level, synthetic probability, and caller identity verification without interrupting the call.
3. **Dedicated Repository:** Maintained in the standalone repository [Vocal_Verify_Overlay](https://github.com/ak4204/Vocal_Verify_Overlay).

---

## 🌐 API & WebSocket Reference

| Route | Protocol | Description |
| :--- | :--- | :--- |
| `GET /health` | HTTP | Service, model runtime, and environment health check. |
| `POST /api/v1/detect` | HTTP | One-shot deepfake detection for recorded audio files. |
| `POST /api/v1/verify-public-figure`| HTTP | Multi-modal cross-verification against enrolled Voice Vault profiles. |
| `GET /api/v1/sessions` | HTTP | Audit history of recent screened telephony sessions. |
| `WS /ws/telephony/{device_id}` | WebSocket | High-throughput bi-directional audio stream for mobile devices. |
| `WS /ws/dashboard` | WebSocket | Real-time event broadcasting channel for the web dashboard. |

---

## 💻 Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- ngrok (optional, for connecting mobile devices outside local Wi-Fi)

### 1. Start the FastAPI Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

### 2. Start the Next.js Dashboard
```bash
npm install
npm run dev
```
Access the dashboard at `http://localhost:3000`.

### 3. Expose via ngrok (For Mobile Telephony)
```bash
ngrok http 8080
```
Enter the resulting forwarding URL (`https://<subdomain>.ngrok-free.app`) into the VocalVerify Call Guard Android app settings.
