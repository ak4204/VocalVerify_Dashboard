"""
app.py
======
Root entry point for Hugging Face Spaces (Free Gradio/Python SDK).
Serves:
  1. Next.js Frontend Dashboard (pre-built static bundle in /out)
  2. Dual-Stream ML/DL Voice Deepfake Inference REST APIs (/api/v1/...)
  3. Real-Time Telephony & Dashboard WebSockets (/ws/...)
  4. Health Check (/health)
"""
import sys
import os
from pathlib import Path

# Add backend and root directory to python path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

import uvicorn
from fastapi.staticfiles import StaticFiles
from backend.main import app

# Mount Next.js static build if available
STATIC_DIR = ROOT / "out"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
