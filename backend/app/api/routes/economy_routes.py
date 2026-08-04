"""Economy Routes v6 — سلطة الخادم فقط، مصادقة، لغة كائن حي (A-001/A-003/A-004)."""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies.auth import get_current_user_id, get_user_tier
from app.infrastructure.database.supabase_client import get_db
from app.core.living_messages import ENERGY, REST_OPTIONS, ACTIONS

logger = logging.getLogger("economy_routes")
router = APIRouter(prefix="/api/economy", tags=["economy"])

CAPS = {"free": {"energy": 3, "capability": 2}, "plus": {"energy": 2, "capability": 2}}
ENERGY_GRANT = 0.17
CAP_PASS_MINUTES = 60
COOLDOWN_HOURS = 2

class AdRewardRequest(BaseModel):
    ad_type: str = "energy"
    ad_platform: str = "admob"
    capability: str = "general"

def _today():
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

def _count(user_id, ad_type):
    res = get_db().table("ad_views").select("id").eq("user_id", user_id) \
        .eq("ad_type", ad_type).gte("created_at", _today()).execute()
    return len(res.data or [])

def _mood(level):
    return "full" if level > 0.7 else "warming" if level > 0.4 else "tired" if level > 0.15 else "exhausted"

@router.get("/balance")
async def get_balance(user_id: str = Depends(get_current_user_id),
                      tier: str = Depends(get_user_tier)):
    from app.engine.energy.twin_energy_engine import twin_energy_engine
    from app.domain.services.limits_service import get_usage_summary
    state = await twin_energy_engine.get_energy_state(user_id, tier=tier)
    usage = get_usage_summary(user_id, tier)
    level = state.get("energy", 0.5)
    mood = _mood(level)
    caps = CAPS.get(tier)
    return {
        "energy": {"level": level, "mood": mood, "living_message": ENERGY[mood],
                   "is_low": state.get("is_low_energy", False),
                   "is_exhausted": state.get("is_exhausted", False)},
        "subscription": {"tier": tier,
                         "messages_remaining": usage.get("messages", {}).get("remaining", 0)},
        "ads": None if caps is None else {
            "energy_left": max(0, caps["energy"] - _count(user_id, "energy")),
            "capability_left": max(0, caps["capability"] - _count(user_id, "capability"))},
        "rest_options": REST_OPTIONS,
    }

@router.post("/ad-reward")
async def claim_ad_reward(body: AdRewardRequest,
                          user_id: str = Depends(get_current_user_id),
                          tier: str = Depends(get_user_tier)):
    if body.ad_type not in ("energy", "capability"):
        raise HTTPException(400, "BAD_AD_TYPE")
    caps = CAPS.get(tier)
    if caps is None:
        return {"success": False, "living_message": ACTIONS["not_for_tier"]}
    if _count(user_id, body.ad_type) >= caps[body.ad_type]:
        raise HTTPException(429, detail=ACTIONS["cap_reached"])
    db = get_db()
    if body.ad_type == "energy":
        last = db.table("ad_views").select("created_at").eq("user_id", user_id) \
            .eq("ad_type", "energy").order("created_at", desc=True).limit(1).execute()
        if last.data and (datetime.now(timezone.utc) -
                datetime.fromisoformat(last.data[0]["created_at"])) < timedelta(hours=COOLDOWN_HOURS):
            raise HTTPException(429, detail=ACTIONS["cooldown"])
    db.table("ad_views").insert({"user_id": user_id, "ad_type": body.ad_type,
                                 "ad_platform": body.ad_platform}).execute()
    if body.ad_type == "energy":
        from app.engine.energy.twin_energy_engine import twin_energy_engine
        await twin_energy_engine.restore_energy(user_id, ENERGY_GRANT, "ad_energy")
        return {"success": True, "grant": "energy", "amount": ENERGY_GRANT,
                "living_message": ACTIONS["ad_refreshed"]}
    expires = (datetime.now(timezone.utc) + timedelta(minutes=CAP_PASS_MINUTES)).isoformat()
    db.table("capability_passes").upsert({"user_id": user_id,
        "capability": body.capability or "general", "expires_at": expires},
        on_conflict="user_id,capability").execute()
    return {"success": True, "grant": "capability", "expires_at": expires,
            "living_message": ACTIONS["capability_hour"]}

@router.post("/rest")
async def take_rest(user_id: str = Depends(get_current_user_id)):
    try:
        get_db().table("twin_internal_states").update({
            "resting_until": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("user_id", user_id).execute()
    except Exception as e:
        logger.warning(f"rest update skipped: {e}")
    return {"success": True, "living_message": ACTIONS["rest_granted"]}

@router.get("/energy/status")
async def energy_status(user_id: str = Depends(get_current_user_id),
                        tier: str = Depends(get_user_tier)):
    from app.engine.energy.twin_energy_engine import twin_energy_engine
    state = await twin_energy_engine.get_energy_state(user_id, tier=tier)
    level = state.get("energy", 0.5)
    mood = _mood(level)
    return {"level": level, "mood": mood, "living_message": ENERGY[mood]}
