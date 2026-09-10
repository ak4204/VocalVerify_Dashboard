# 🛡️ VocalVerify: Voice Intelligence Workspace & Telecom Call Guard

VocalVerify is a dual-stream, multi-modal voice deepfake and acoustic impersonation detection engine. It delivers sub-50ms inference for real-time mobile telephony, streaming voice notes, and public figure video cross-verification.

## 🚀 Architecture Overview

```
                          [ Android Call Guard Overlay ]
                                       │ (WSS PCM-16 frames)
                                       ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │  Hugging Face Space (Port 7860)                                        │
    │                                                                        │
    │   Nginx Reverse Proxy                                                  │
    │   ├── /ws/telephony/{device_id} ──► FastAPI WebSocket Engine (:8000)   │
    │   ├── /ws/dashboard             ──► FastAPI Live Event Stream (:8000)  │
    │   ├── /api/v1/                  ──► FastAPI REST Endpoints (:8000)     │
    │   └── /                         ──► Next.js Dashboard UI (:3000)       │
    │                                                                        │
    │   Inference Engines:                                                   │
    │   ├── PLAD Liveness Biomarkers (Jitter RAP, Shimmer APQ3, Breath, Flux)│
    │   ├── 55-Feature XGBoost Acoustic Classifier                           │
    │   ├── ONNX Wav2Vec 2.0 + ResNet Deep Learning Architecture             │
    │   └── ECAPA / d-Vector 3-Sample Centroid Cosine Similarity             │
    └────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Connecting the Android Mobile Call Guard App

1. Deploy this Space on Hugging Face (Docker Space).
2. Note your Space domain: `https://<your-username>-<your-space-name>.hf.space`.
3. Open the **VocalVerify Call Guard** app on your Android phone.
4. In the settings field, enter your WebSocket endpoint:
   ```
   wss://<your-username>-<your-space-name>.hf.space
   ```
5. Tap **Save Hugging Face endpoint**.
6. When an incoming call arrives, the app streams PCM-16 audio frames to `/ws/telephony/{device_id}` and renders a floating security overlay with the real-time AI impersonation threat score!

---

## 🌐 API Endpoints

- `GET /health` : System and model health check.
- `POST /api/v1/verify-public-figure` : Multi-modal video/audio cross-verification against public figure baselines or manual reference clips.
- `POST /api/v1/detect` : One-shot deepfake audio detection.
- `GET /api/v1/sessions` : Audit log of recent call sessions.
- `WS /ws/telephony/{device_id}` : High-throughput bi-directional audio stream for telephony devices.
- `WS /ws/dashboard` : Live event feed for dashboard real-time monitoring.
