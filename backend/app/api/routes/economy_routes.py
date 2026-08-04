"""ECONOMY ROUTES v4.0 — server-authoritative energy & ad grants.
Implements Amendments A-001/A-002: free 5 ads/day (3 energy + 2 capability),
plus 2/day, premium+ zero. Energy grants and caps enforced HERE only."""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies.auth import get_current_user_id, get_user_tier
from app.infrastructure.database.supabase_client import get_db

logger = logging.getLogger("economy_routes")
router = APIRouter(prefix="/api/economy", tags=["economy"])

DAILY_AD_CAPS = {"free": {"energy": 3, "capability": 2},
                 "plus": {"energy": 1, "capability": 1}}
ENERGY_GRANT = 0.17          # ~ +50% موزعة على 3 إعلانات
CAP_PASS_MINUTES = 60
ENERGY_COOLDOWN_HOURS = 2

class AdRewardRequest(BaseModel):
    ad_type: str = "energy"   # energy | capability
    ad_platform: str = "admob"

def _today():
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

@router.get("/balance")
async def get_balance(user_id: str = Depends(get_current_user_id),
                      tier: str = Depends(get_user_tier)):
    from app.engine.energy.twin_energy_engine import twin_energy_engine
    from app.domain.services.limits_service import get_usage_summary
    from app.domain.services.tier_service import is_ads_required
    energy = await twin_energy_engine.get_energy_state(user_id, tier=tier)
    usage = get_usage_summary(user_id, tier)
    return {
        "energy": {"level": energy.get("energy", 0.5),
                   "is_low": energy.get("is_low_energy", False),
                   "is_exhausted": energy.get("is_exhausted", False),
                   "recommendation": energy.get("recommendation", "")},
        "subscription": {"tier": tier,
                         "ads_required": is_ads_required(tier),
                         "messages_remaining": usage.get("messages", {}).get("remaining", 0)},
    }

@router.post("/ad-reward")
async def claim_ad_reward(body: AdRewardRequest,
                          user_id: str = Depends(get_current_user_id),
                          tier: str = Depends(get_user_tier)):
    if body.ad_type not in ("energy", "capability"):
        raise HTTPException(400, "BAD_AD_TYPE")
    caps = DAILY_AD_CAPS.get(tier)
    if caps is None:
        raise HTTPException(403, "ADS_NOT_AVAILABLE_FOR_TIER")
    db = get_db()
    today = _today()
    used = db.table("ad_views").select("id").eq("user_id", user_id) \
        .eq("ad_type", body.ad_type).gte("created_at", today).execute()
    if len(used.data or []) >= caps[body.ad_type]:
        raise HTTPException(429, "DAILY_AD_CAP_REACHED")
    if body.ad_type == "energy":
        last = db.table("ad_views").select("created_at").eq("user_id", user_id) \
            .eq("ad_type", "energy").order("created_at", desc=True).limit(1).execute()
        if last.data:
            dt = datetime.fromisoformat(last.data[0]["created_at"])
            if datetime.now(timezone.utc) - dt < timedelta(hours=ENERGY_COOLDOWN_HOURS):
                raise HTTPException(429, "AD_COOLDOWN")
    db.table("ad_views").insert({"user_id": user_id, "ad_type": body.ad_type,
                                 "ad_platform": body.ad_platform}).execute()
    if body.ad_type == "energy":
        from app.engine.energy.twin_energy_engine import twin_energy_engine
        await twin_energy_engine.restore_energy(user_id, ENERGY_GRANT, "ad_energy")
        return {"success": True, "grant": "energy", "amount": ENERGY_GRANT}
    from app.domain.billing.ad_service import claim_ad_reward
    return await claim_ad_reward(user_id, "rewarded", body.ad_platform, CAP_PASS_MINUTES)

@router.post("/daily-login")
async def daily_login(user_id: str = Depends(get_current_user_id)):
    db = get_db(); today = _today()
    exist = db.table("ad_views").select("id").eq("user_id", user_id) \
        .eq("ad_type", "daily_login").gte("created_at", today).execute()
    if exist.data:
        return {"success": False, "message": "already_claimed"}
    db.table("ad_views").insert({"user_id": user_id, "ad_type": "daily_login",
                                 "ad_platform": "system"}).execute()
    from app.engine.energy.twin_energy_engine import twin_energy_engine
    await twin_energy_engine.restore_energy(user_id, 0.05, "daily_login")
    return {"success": True}

@router.get("/energy/status")
async def get_energy_status(user_id: str = Depends(get_current_user_id),
                            tier: str = Depends(get_user_tier)):
    from app.engine.energy.twin_energy_engine import twin_energy_engine
    return await twin_energy_engine.get_energy_state(user_id, tier=tier)
