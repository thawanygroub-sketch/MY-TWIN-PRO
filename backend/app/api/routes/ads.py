"""Ads Routes v2 — A-003: مصادقة + حدود خادم + مدة خادم.
يتجاهل أي user_id أو pass_duration قادم من العميل."""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies.auth import get_current_user_id, get_user_tier
from app.infrastructure.database.supabase_client import get_db
logger = logging.getLogger("ads_routes")
router = APIRouter(prefix="/api/ads", tags=["ads"])

CAPS = {"free": {"energy": 3, "capability": 2}, "plus": {"energy": 2, "capability": 2}}
ENERGY_GRANT = 0.17
CAP_PASS_MINUTES = 60
COOLDOWN_HOURS = 2

class AdRewardRequest(BaseModel):
    ad_type: str = "energy"
    ad_platform: str = "admob"
    capability: str = "general"

def _today():
    return datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).isoformat()

def _count(user_id, ad_type):
    res = get_db().table("ad_views").select("id").eq("user_id",user_id) \
        .eq("ad_type",ad_type).gte("created_at",_today()).execute()
    return len(res.data or [])

@router.get("/status")
async def status(user_id: str = Depends(get_current_user_id), tier: str = Depends(get_user_tier)):
    caps = CAPS.get(tier)
    if caps is None:
        return {"watched_today":0,"remaining_today":0,"max_daily_ads":0,
                "can_watch":False,"tier":tier,"ads_available":False}
    e, c = _count(user_id,"energy"), _count(user_id,"capability")
    return {"watched_today": e+c,
        "remaining_today": max(0,(caps["energy"]-e)+(caps["capability"]-c)),
        "max_daily_ads": caps["energy"]+caps["capability"],
        "can_watch": e<caps["energy"] or c<caps["capability"],
        "energy_left": max(0,caps["energy"]-e),
        "capability_left": max(0,caps["capability"]-c),
        "tier": tier, "ads_available": True}

@router.post("/reward")
async def claim_reward(req: AdRewardRequest,
                       user_id: str = Depends(get_current_user_id),
                       tier: str = Depends(get_user_tier)):
    if req.ad_type not in ("energy","capability"): raise HTTPException(400,"BAD_AD_TYPE")
    caps = CAPS.get(tier)
    if caps is None: raise HTTPException(403,"ADS_NOT_AVAILABLE_FOR_TIER")
    if _count(user_id, req.ad_type) >= caps[req.ad_type]:
        raise HTTPException(429,"DAILY_AD_CAP_REACHED")
    db = get_db()
    if req.ad_type == "energy":
        last = db.table("ad_views").select("created_at").eq("user_id",user_id) \
            .eq("ad_type","energy").order("created_at",desc=True).limit(1).execute()
        if last.data and (datetime.now(timezone.utc) -
                datetime.fromisoformat(last.data[0]["created_at"])) < timedelta(hours=COOLDOWN_HOURS):
            raise HTTPException(429,"AD_COOLDOWN")
    db.table("ad_views").insert({"user_id":user_id,"ad_type":req.ad_type,
                                 "ad_platform":req.ad_platform}).execute()
    if req.ad_type == "energy":
        from app.engine.energy.twin_energy_engine import twin_energy_engine
        await twin_energy_engine.restore_energy(user_id, ENERGY_GRANT, "ad_energy")
        return {"success":True,"grant":"energy","amount":ENERGY_GRANT,
                "living_message":"شكرًا لك. استعدت بعض نشاطي، وأنا معك من جديد."}
    expires = (datetime.now(timezone.utc)+timedelta(minutes=CAP_PASS_MINUTES)).isoformat()
    db.table("capability_passes").upsert({"user_id":user_id,
        "capability":req.capability or "general","expires_at":expires},
        on_conflict="user_id,capability").execute()
    return {"success":True,"grant":"capability","expires_at":expires,
            "living_message":"فتحتَ لي ساعة كاملة أستطيع فيها استخدام قدراتي معك."}
