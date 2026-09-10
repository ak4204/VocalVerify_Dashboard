"""
main.py
────────
FastAPI application entry point.
Startup: initialises DB + loads inference models.
"""
import logging
import sys
from contextlib import asynccontextmanager

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

# Allow Next.js frontend (ports 3000–3010) and Android dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "*",   # remove in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────
app.include_router(ws_router)
app.include_router(dash_router)


# ── Health check ─────────────────────────────────────────────────────
@app.get("/health")
async def health():
    engine = get_engine()
    return {
        "status": "ok",
        "ml_loaded": engine.ml_loaded,
        "dl_loaded": engine.dl_loaded,
    }
