"""System Routes — نقطة الـ Cron للتوطيد."""
import os, logging
from fastapi import APIRouter, Header, HTTPException
logger = logging.getLogger("system_routes")
router = APIRouter(prefix="/api/system", tags=["system"])
@router.post("/consolidate")
async def consolidate(x_cron_secret: str = Header(None)):
    if not x_cron_secret or x_cron_secret != os.getenv("CRON_SECRET_KEY", ""):
        raise HTTPException(403, "forbidden")
    from app.core.soul_core import soul_kernel, SoulEvent
    from app.infrastructure.database.supabase_client import get_db
    from datetime import datetime, timezone, timedelta
    cut = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    res = get_db().table("profiles").select("id").gte("last_active", cut).limit(10).execute()
    done = 0
    for r in (res.data or []):
        await soul_kernel.dispatch(SoulEvent("offline_processing", {"user_id": r["id"]}, user_id=r["id"], source="cron"))
        await soul_kernel.dispatch(SoulEvent("episodic_narrative", {"user_id": r["id"]}, user_id=r["id"], source="cron"))
        done += 1
    return {"consolidated": done}
