"""Consolidation Worker v1 — دورة الانعكاس (الفصل 79):
يرقّي المهم من الذاكرة العاملة إلى الطويلة قبل انتهاء نافذة 24 ساعة.
نافذة المعالجة: 6–20 ساعة (بين دورات الـ cron) لمنع الترقية المكررة."""
import logging
from datetime import datetime, timezone, timedelta
from app.infrastructure.database.supabase_client import get_db
from app.memory.importance_engine import compute_importance
logger = logging.getLogger("consolidation")

async def _promote(row: dict, importance: int) -> bool:
    try:
        from app.memory.unified_memory import unified_memory_engine
        await unified_memory_engine.store(
            user_id=row["user_id"], content=row.get("message", ""),
            reply=row.get("reply", ""), emotion=row.get("emotion", "neutral"),
            importance=importance, lang="ar")
        return True
    except Exception as e:
        logger.warning(f"promote failed: {e}")
        return False

async def consolidate_user(user_id: str) -> int:
    db = get_db()
    now = datetime.now(timezone.utc)
    lo = (now - timedelta(hours=20)).isoformat()
    hi = (now - timedelta(hours=6)).isoformat()
    res = db.table("working_memory").select("*").eq("user_id", user_id) \
        .gte("created_at", lo).lte("created_at", hi).execute()
    promoted = 0
    for r in (res.data or []):
        imp = compute_importance(r.get("message"), r.get("reply"), r.get("emotion", "neutral"))
        if imp >= 65 and await _promote(r, imp):
            promoted += 1
    return promoted

async def run_consolidation() -> dict:
    db = get_db()
    lo = (datetime.now(timezone.utc) - timedelta(hours=20)).isoformat()
    res = db.table("working_memory").select("user_id").gte("created_at", lo).execute()
    users = sorted({r["user_id"] for r in (res.data or [])})
    total = 0
    for u in users:
        total += await consolidate_user(u)
    logger.info(f"🧠 Consolidation done: users={len(users)} promoted={total}")
    return {"users": len(users), "promoted": total}
