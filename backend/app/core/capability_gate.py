"""Capability Gate — حوكمة القدرات حسب الباقة والطاقة وساعات الفتح.
قاعدة: القدرات تُكتشف بالنية، وتُفتح بالطاقة أو بالساعة، ولا تُعلن أبدًا."""
from datetime import datetime, timezone
from app.infrastructure.database.supabase_client import get_db

TIER_CAPS = {
    "free":    {"daily_capability_ads": 2, "energy_ads": 3},
    "plus":    {"daily_capability_ads": 2, "energy_ads": 2},
    "premium": {"daily_capability_ads": 0, "energy_ads": 0},
    "pro":     {"daily_capability_ads": 0, "energy_ads": 0},
    "yearly":  {"daily_capability_ads": 0, "energy_ads": 0},
}

CAPABILITY_TIERS = {
    "study": "free", "dream": "free", "business": "plus", "creator": "plus",
    "code_lab": "premium", "image_lab": "premium", "smart_home": "premium",
    "task_manager": "free", "life_coach": "plus",
}

LEVEL = {"free": 0, "plus": 1, "premium": 2, "pro": 3, "yearly": 4}

async def can_use_capability(user_id: str, tier: str, capability: str) -> dict:
    """يعيد {allowed, reason} بأسباب داخلية (لا تُعرض للمستخدم)."""
    if LEVEL.get(tier, 0) < LEVEL.get(CAPABILITY_TIERS.get(capability, "free"), 0):
        return {"allowed": False, "reason": "tier_locked"}
    db = get_db()
    active = db.table("capability_passes").select("id").eq("user_id", user_id) \
        .eq("capability", capability).gt("expires_at", datetime.now(timezone.utc).isoformat()) \
        .execute()
    if active.data:
        return {"allowed": True, "reason": "pass_active"}
    energy = db.table("twin_internal_states").select("energy_level") \
        .eq("user_id", user_id).maybe_single().execute()
    level = (energy.data or {}).get("energy_level", 0.5) if energy.data else 0.5
    if level <= 0.15:
        return {"allowed": False, "reason": "energy_low"}
    return {"allowed": True, "reason": "energy_ok"}
