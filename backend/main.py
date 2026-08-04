"""MyTwin API v22.1.0 — gated, rate-limited, graceful, observable."""
import logging, sys, os, time, uuid
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR)); sys.path.insert(0, str(BASE_DIR / 'app'))
logging.basicConfig(level=logging.INFO,
    format='%(asctime)s | %(name)-25s | %(levelname)-8s | %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger("mytwin.api")

from dotenv import load_dotenv
load_dotenv(BASE_DIR / '.env')
from app.core.config import config

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🌟 Initializing systems...")
    try:
        from app.infrastructure.ai.ai_gateway import ai_gateway
        logger.info("   ✅ AI Gateway")
    except Exception as e: logger.error(f"   ❌ AI Gateway: {e}")
    try:
        from app.infrastructure.database.supabase_client import get_db
        get_db(); logger.info("   ✅ Supabase")
    except Exception as e: logger.error(f"   ❌ Supabase: {e}")
    try:
        from app.twin_state.existence_loop import existence_loop
        await existence_loop.start(); logger.info("   ✅ Existence Loop")
    except Exception as e: logger.error(f"   ❌ Existence Loop: {e}")
    logger.info(f"🌟 MyTwin API v22.1.0 started | profile={os.getenv('MYTWIN_RELEASE_PROFILE','production')}")
    yield
    logger.info("👋 Shutting down...")

app = FastAPI(title="MyTwin API", version="22.1.0",
    docs_url="/docs" if config.DEBUG else None,
    redoc_url=None, lifespan=lifespan)

allowed = config.ALLOWED_ORIGINS
app.add_middleware(CORSMiddleware, allow_origins=allowed,
    allow_credentials=("*" not in allowed), allow_methods=["*"], allow_headers=["*"])

from app.api.dependencies.rate_limit import setup_rate_limiting
setup_rate_limiting(app)

from app.api.routes import api_router
app.include_router(api_router)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    if time.time() - start > 2.0:
        logger.warning(f"⏳ Slow: {request.method} {request.url.path}")
    return response

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    rid = uuid.uuid4().hex[:12]
    logger.error(f"[{rid}] unhandled: {exc}")
    return JSONResponse(status_code=500, content={
        "error": {"code": "INTERNAL",
                  "message": "لحظة صعوبة عابرة. أنا ما زلت هنا.",
                  "request_id": rid}})

@app.get("/health")
async def health():
    return JSONResponse(content={"api": "healthy", "version": "22.1.0"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
