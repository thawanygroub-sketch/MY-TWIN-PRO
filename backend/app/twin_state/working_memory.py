"""Working Memory v2 — لا حذف صامت: فشل الحفظ يدخل طابور إعادة محاولة."""
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from app.infrastructure.database.supabase_client import get_db
logger = logging.getLogger("working_memory")
class WorkingMemory:
    def __init__(self):
        self._cache: Dict[str, List[Dict]] = {}
        self._pending: List[Dict] = []
    async def _flush_pending(self):
        if not self._pending: return
        db = get_db(); still = []
        for item in self._pending:
            try: db.table("working_memory").insert(item).execute()
            except Exception: still.append(item)
        self._pending = still
    async def add_interaction(self, user_id, message, reply, emotion):
        entry = {"timestamp": datetime.now(timezone.utc).isoformat(),
                 "message": message[:500], "reply": reply[:500], "emotion": emotion}
        self._cache.setdefault(user_id, []).append(entry)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        self._cache[user_id] = [e for e in self._cache[user_id]
            if datetime.fromisoformat(e["timestamp"]) > cutoff]
        row = {"user_id":user_id,"message":message[:500],"reply":reply[:500],
               "emotion":emotion,"created_at":entry["timestamp"]}
        try:
            await self._flush_pending()
            get_db().table("working_memory").insert(row).execute()
        except Exception as e:
            logger.warning(f"working_memory persist failed → queued: {e}")
            self._pending.append(row)
    async def get_recent_context(self, user_id, limit=5) -> List[Dict[str, Any]]:
        if user_id in self._cache: return self._cache[user_id][-limit:]
        try:
            db = get_db()
            cutoff = (datetime.now(timezone.utc)-timedelta(hours=24)).isoformat()
            res = db.table("working_memory").select("*").eq("user_id",user_id) \
                .gte("created_at",cutoff).order("created_at",desc=True).limit(limit).execute()
            if res.data:
                self._cache[user_id] = [{"timestamp":r["created_at"],"message":r["message"],
                    "reply":r["reply"],"emotion":r.get("emotion","neutral")} for r in reversed(res.data)]
                return self._cache[user_id][-limit:]
        except Exception as e:
            logger.warning(f"working_memory read failed: {e}")
        return []
    async def get_context_for_prompt(self, user_id) -> str:
        recent = await self.get_recent_context(user_id, 5)
        if not recent: return ""
        lines = ["[آخر التفاعلات في الساعات الماضية:]"]
        for e in recent:
            lines.append(f"- المستخدم: {e['message'][:150]}"); lines.append(f"  التوأم: {e['reply'][:150]}")
        return "\n".join(lines)
working_memory = WorkingMemory()
logger.info("✅ Working Memory v2")
