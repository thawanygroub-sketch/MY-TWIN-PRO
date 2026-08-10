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


@router.get("/status")
async def system_status():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    engines = ["identity","memory","reflection","relationship","curiosity","world_model","self_model","proactive","dreaming","energy","cognitive_load","context_awareness","internal_state","ai_gateway"]
    out = {"ok": True, "engines": engines, "engines_count": len(engines), "last_heartbeat_sec_ago": None}
    try:
        from app.infrastructure.database.supabase_client import get_db
        db = get_db(); ts = None
        for table in ("twin_internal_states", "twin_internal_state"):
            try:
                r = db.table(table).select("updated_at").order("updated_at", desc=True).limit(1).execute()
                if r.data: ts = r.data[0].get("updated_at"); break
            except Exception: continue
        if ts:
            out["last_heartbeat_sec_ago"] = int((now - datetime.fromisoformat(ts.replace("Z", "+00:00"))).total_seconds())
    except Exception as e:
        out["heartbeat_error"] = str(e)[:120]
    return out

@router.get("/snapshot")
async def user_snapshot(user_id: str = ""):
    out = {"ok": True, "state": None}
    if not user_id: return out
    try:
        from app.infrastructure.database.supabase_client import get_db
        db = get_db()
        for table in ("twin_internal_states", "twin_internal_state"):
            try:
                r = db.table(table).select("*").eq("user_id", user_id).limit(1).execute()
                if r.data: out["state"] = r.data[0]; break
            except Exception: continue
    except Exception as e:
        out["error"] = str(e)[:120]
    return out
