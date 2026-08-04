"""System Routes — مهام الخلفية المحكومة (CRON_SECRET_KEY فقط)."""
import os, logging
from fastapi import APIRouter, Header, HTTPException
logger = logging.getLogger("system_routes")
router = APIRouter(prefix="/api/system", tags=["system"])

def _cron_ok(secret: str) -> bool:
    expected = os.getenv("CRON_SECRET_KEY", "")
    return bool(expected) and secret == expected

@router.post("/consolidate")
async def consolidate(x_cron_secret: str = Header("")):
    if not _cron_ok(x_cron_secret):
        raise HTTPException(403, "CRON_ONLY")
    from app.memory.consolidation_worker import run_consolidation
    result = await run_consolidation()
    return {"success": True, **result}

@router.get("/health")
async def health():
    return {"status": "ok"}
