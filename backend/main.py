"""
main.py
────────
FastAPI application entry point.
Startup: initialises DB + loads inference models.
"""
import logging
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure backend and root directories are in sys.path for direct uvicorn invocations
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import database
from core.inference_engine import get_engine
from api.routes_websocket import router as ws_router
from api.routes_dashboard import router as dash_router


# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("==== VocalVerify Backend Starting ====")
    # Init DB
    await database.init_db()
    # Pre-load models (avoids cold-start latency on first request)
    engine = get_engine()
    logger.info(f"  ML model loaded: {engine.ml_loaded}")
    logger.info(f"  DL model loaded: {engine.dl_loaded}")
    logger.info("==== Ready ====")
    yield
    logger.info("━━━━ VocalVerify Backend Shutting Down ━━━━")


# ── App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="VocalVerify Detection Engine",
    description="Real-time voice deepfake detection WebSocket API",
    version="1.0.0",
    lifespan=lifespan,
)

# Permissive CORS & ngrok configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_ngrok_headers(request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# ── Routers ───────────────────────────────────────────────────────────
app.include_router(ws_router)
app.include_router(dash_router)


# ── Root & Health check ───────────────────────────────────────────────
@app.get("/")
async def root():
    from api.routes_websocket import get_active_phone_devices
    active_phones = get_active_phone_devices()
    return {
        "engine": "VocalVerify Real-Time Detection Engine",
        "status": "online",
        "tunnel": "ngrok compatible",
        "active_devices": list(active_phones.keys()),
        "endpoints": {
            "telephony_ws": "/ws/telephony/{device_id}",
            "dashboard_ws": "/ws/dashboard",
            "health": "/health",
        },
    }


@app.get("/health")
async def health():
    engine = get_engine()
    return {
        "status": "ok",
        "ml_loaded": engine.ml_loaded,
        "dl_loaded": engine.dl_loaded,
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    logger.info(f"Starting VocalVerify engine on 0.0.0.0:{port} (ngrok compatible)")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, proxy_headers=True, forwarded_allow_ips="*")

