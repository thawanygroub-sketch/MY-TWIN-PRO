"""Billing Routes v6.0 — real Play verification, guarded internal ops."""
import logging, os, hashlib
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from app.api.dependencies.auth import get_current_user_id
from app.infrastructure.database.supabase_client import get_db

logger = logging.getLogger("billing_routes")
router = APIRouter(prefix="/api/billing", tags=["billing"])

TIER_MAP = {
    "mytwin_plus_monthly":    {"tier": "plus",    "duration_days": 30},
    "mytwin_premium_monthly": {"tier": "premium", "duration_days": 30},
    "mytwin_pro_semiannual":  {"tier": "pro",     "duration_days": 183},
    "mytwin_yearly_annual":   {"tier": "yearly",  "duration_days": 365},
}

def _internal_ok(key: Optional[str]) -> bool:
    expected = os.getenv("SOUL_SYNC_INTERNAL_KEY", "")
    return bool(expected) and key == expected

class PurchaseRequest(BaseModel):
    product_id: str = Field(..., min_length=3, max_length=60)
    purchase_token: str = Field(..., min_length=10, max_length=1000)

class TemporaryUpgradeRequest(BaseModel):
    user_id: str = Field(..., min_length=3)
    tier: str = Field(..., min_length=2)
    duration_days: int = Field(1, ge=1, le=30)

@router.post("/verify")
async def verify_purchase(body: PurchaseRequest, user_id: str = Depends(get_current_user_id)):
    info = TIER_MAP.get(body.product_id)
    if not info: raise HTTPException(400, "INVALID_PRODUCT")
    from app.domain.billing.play_verifier import verify_subscription
    if not await verify_subscription(body.product_id, body.purchase_token):
        raise HTTPException(402, "PURCHASE_NOT_VERIFIED")
    tier, days = info["tier"], info["duration_days"]
    token_hash = hashlib.sha256(body.purchase_token.encode()).hexdigest()
    db = get_db()
    existing = db.table("purchase_history").select("id,user_id").eq("token_hash", token_hash).execute()
    if existing.data and existing.data[0].get("user_id") != user_id:
        raise HTTPException(400, "TOKEN_ALREADY_USED")
    from app.domain.billing.subscription_service import upgrade_subscription
    if not await upgrade_subscription(user_id, tier, days):
        raise HTTPException(500, "UPGRADE_FAILED")
    expires_at = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    db.table("purchase_history").insert({
        "user_id": user_id, "product_id": body.product_id, "token_hash": token_hash,
        "tier": tier, "duration_days": days, "expires_at": expires_at,
        "verified_at": datetime.now(timezone.utc).isoformat()}).execute()
    return {"success": True, "tier": tier, "duration_days": days, "expires_at": expires_at}

@router.get("/status")
async def get_status(user_id: str = Depends(get_current_user_id)):
    from app.domain.billing.subscription_service import get_user_subscription
    sub = await get_user_subscription(user_id)
    return {"tier": sub.get("tier", "free"),
            "plan_name": sub.get("plan", {}).get("name", "Free"),
            "expires_at": sub.get("expires_at"),
            "is_active": sub.get("is_active", True)}

@router.post("/upgrade-temporary")
async def upgrade_temporary(body: TemporaryUpgradeRequest,
                            x_internal_key: Optional[str] = Header(None)):
    if not _internal_ok(x_internal_key): raise HTTPException(403, "INTERNAL_ONLY")
    from app.domain.billing.subscription_service import upgrade_subscription
    if not await upgrade_subscription(body.user_id, body.tier, body.duration_days):
        raise HTTPException(500, "TEMP_UPGRADE_FAILED")
    return {"success": True, "tier": body.tier, "duration_days": body.duration_days}

@router.post("/restore")
async def restore_purchases(user_id: str = Depends(get_current_user_id)):
    from app.domain.billing.subscription_service import get_user_subscription, upgrade_subscription
    current = await get_user_subscription(user_id)
    if current.get("tier") != "free" and current.get("is_active"):
        return {"success": True, "tier": current["tier"], "message": "Already active"}
    db = get_db()
    last = db.table("purchase_history").select("tier,duration_days") \
        .eq("user_id", user_id).order("verified_at", desc=True).limit(1).execute()
    if last.data:
        p = last.data[0]
        await upgrade_subscription(user_id, p["tier"], p["duration_days"])
        return {"success": True, "tier": p["tier"], "message": "Restored"}
    return {"success": False, "message": "No purchases found"}

@router.post("/cancel")
async def cancel_subscription(user_id: str = Depends(get_current_user_id)):
    get_db().table("profiles").update({"auto_renew": False}).eq("id", user_id).execute()
    return {"success": True}

@router.get("/plans")
async def get_plans():
    from app.domain.billing.subscription_service import SUBSCRIPTION_PLANS
    return {"plans": [{"tier": t, "name": p["name"], "price": p["price"],
                       "messages": p["messages"], "features": p["features"]}
                      for t, p in SUBSCRIPTION_PLANS.items()]}

@router.get("/revenue")
async def get_revenue(x_internal_key: Optional[str] = Header(None)):
    if not _internal_ok(x_internal_key): raise HTTPException(403, "INTERNAL_ONLY")
    from app.domain.billing.revenue_service import get_monthly_revenue, get_total_revenue
    return {"monthly": await get_monthly_revenue(), "total": await get_total_revenue(30)}

@router.get("/costs")
async def get_costs(x_internal_key: Optional[str] = Header(None)):
    if not _internal_ok(x_internal_key): raise HTTPException(403, "INTERNAL_ONLY")
    from app.domain.billing.cost_dashboard import get_cost_summary
    return await get_cost_summary(30)

@router.get("/health")
async def billing_health():
    return {"status": "healthy",
            "google_play_configured": bool(os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"))}
