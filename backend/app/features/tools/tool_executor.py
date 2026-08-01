"""
Tool Executor v5.1 – منفذ القدرات مع دعم Pipeline
=====================================================
يدعم: تنفيذ قدرة واحدة أو Pipeline كامل.
يحتفظ بـ Caching و Timeout.
"""
import logging, time, asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger("tool_executor")

_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300

class ToolExecutor:
    async def execute(self, tool_name: str, message: str, user_id: str, tier: str = "free", user_profile: Optional[Dict] = None) -> Optional[str]:
        """تنفيذ قدرة واحدة"""
        from app.features.tools.capability_registry import CapabilityRegistry

        tool_func = CapabilityRegistry.get(tool_name)
        if not tool_func:
            from app.features.tools.tool_registry import ToolRegistry
            tool_func = ToolRegistry.get_tool(tool_name)
        
        if not tool_func:
            logger.warning(f"Capability not found: {tool_name}")
            return None

        cache_key = f"{user_id}:{tool_name}:{message[:50]}"
        if cache_key in _cache:
            cached = _cache[cache_key]
            if datetime.now() - cached["time"] < timedelta(seconds=CACHE_TTL):
                return cached["result"]

        start = time.time()
        try:
            result = await asyncio.wait_for(tool_func(user_id, message), timeout=15.0)
            _cache[cache_key] = {"result": result, "time": datetime.now()}
            await self._save_to_history(user_id, tool_name, str(result)[:500] if result else "")
            elapsed = (time.time() - start) * 1000
            CapabilityRegistry.update_health(tool_name, elapsed, True)
            logger.info(f"✅ {tool_name}: {elapsed:.0f}ms")
            return result
        except asyncio.TimeoutError:
            CapabilityRegistry.update_health(tool_name, 15000, False)
            logger.warning(f"⏱️ {tool_name} timed out")
            return None
        except Exception as e:
            CapabilityRegistry.update_health(tool_name, 0, False)
            logger.error(f"❌ {tool_name} failed: {e}")
            return None

    async def execute_pipeline(self, capabilities: List[str], message: str, user_id: str, tier: str = "free") -> List[Dict[str, Any]]:
        """تنفيذ Pipeline كامل من القدرات"""
        results = []
        for cap in capabilities:
            result = await self.execute(cap, message, user_id, tier)
            results.append({"capability": cap, "result": result, "success": result is not None})
        return results

    async def _save_to_history(self, user_id: str, tool_name: str, result: str):
        """حفظ نتيجة الأداة في سجل المشاريع"""
        try:
            from app.infrastructure.database.supabase_client import get_db
            db = get_db()
            if db:
                db.table("projects").insert({
                    "title": f"أداة: {tool_name}",
                    "type": "tool",
                    "data": {"tool": tool_name, "result": result[:500]},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "user_id": user_id
                }).execute()
        except Exception:
            pass


tool_executor = ToolExecutor()
