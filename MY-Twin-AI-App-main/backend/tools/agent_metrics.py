"""
MyTwin – Agent Metrics v1.0 (Performance Tracking)
- يسجل أداء الأدوات والـ Agent Loop
- يخزن في Supabase للتحليل المستقبلي
"""
import os, logging, time
from typing import Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger("agent_metrics")

class AgentMetrics:
    def __init__(self):
        self._db = None

    def _get_db(self):
        if not self._db:
            try:
                from supabase import create_client
                self._db = create_client(
                    os.getenv("SUPABASE_URL", ""),
                    os.getenv("SUPABASE_SERVICE_KEY", "")
                )
            except:
                pass
        return self._db

    async def log_tool_execution(
        self,
        user_id: str,
        tool_name: str,
        success: bool,
        latency_ms: float = 0,
        input_query: str = "",
        output_summary: str = "",
        error_message: str = ""
    ):
        """تسجيل تنفيذ أداة"""
        db = self._get_db()
        if not db:
            return
        try:
            db.table("agent_metrics").insert({
                "user_id": user_id,
                "tool_name": tool_name,
                "success": success,
                "latency_ms": latency_ms,
                "input_query": input_query[:200],
                "output_summary": output_summary[:200],
                "error_message": error_message[:200],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to log metric: {e}")

    async def get_tool_stats(self, user_id: str) -> Dict[str, Any]:
        """إحصائيات استخدام الأدوات لمستخدم"""
        db = self._get_db()
        if not db:
            return {}
        try:
            res = db.table("agent_metrics").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(100).execute()
            if not res.data:
                return {"total": 0, "tools": {}}
            
            stats = {"total": len(res.data), "tools": {}}
            for row in res.data:
                tool = row["tool_name"]
                if tool not in stats["tools"]:
                    stats["tools"][tool] = {"count": 0, "success": 0}
                stats["tools"][tool]["count"] += 1
                if row["success"]:
                    stats["tools"][tool]["success"] += 1
            return stats
        except Exception as e:
            logger.warning(f"Failed to get stats: {e}")
            return {}


agent_metrics = AgentMetrics()
print("✅ Agent Metrics v1.0 initialized")
