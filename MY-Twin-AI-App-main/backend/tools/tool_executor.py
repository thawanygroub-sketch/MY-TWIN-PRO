"""
MyTwin – Tool Executor v2.0 (Dynamic Calling + Cache + Budget)
- يستخدم inspect لاستدعاء الأدوات ديناميكياً بأمان
- كاش بسيط لتجنب تكرار استدعاءات API المتطابقة
- ميزانية مدمجة
"""
import logging, time, inspect
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from .tool_argument_builder import tool_argument_builder
from reasoning_engine import ToolRegistry

logger = logging.getLogger("tool_executor")

# كاش بسيط (في الذاكرة)
_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300  # 5 دقائق

class ToolExecutor:
    async def execute(
        self,
        tool_name: str,
        message: str,
        user_id: str,
        tier: str = "free",
        user_profile: Optional[Dict] = None
    ) -> Optional[str]:
        tool_func = ToolRegistry.get_tool(tool_name)
        if not tool_func:
            logger.warning(f"الأداة غير موجودة: {tool_name}")
            return None

        # ✅ 1. كاش
        cache_key = f"{user_id}:{tool_name}:{message[:50]}"
        if cache_key in _cache:
            cached = _cache[cache_key]
            if datetime.now() - cached["time"] < timedelta(seconds=CACHE_TTL_SECONDS):
                logger.info(f"⚡ كاش: {tool_name}")
                return cached["result"]

        # ✅ 2. بناء الوسائط
        args = tool_argument_builder.build_args(
            tool_name=tool_name, message=message, user_id=user_id,
            tier=tier, user_profile=user_profile
        )

        # ✅ 3. استدعاء ديناميكي آمن
        start = time.time()
        try:
            sig = inspect.signature(tool_func)
            kwargs = {}
            for param_name, param in sig.parameters.items():
                if param_name in args:
                    kwargs[param_name] = args[param_name]
                elif param.default is not inspect.Parameter.empty:
                    pass  # نترك القيمة الافتراضية
                elif param_name == "user_id":
                    kwargs[param_name] = user_id
                elif param_name == "query":
                    kwargs[param_name] = message
                elif param_name == "tier":
                    kwargs[param_name] = tier

            result = await tool_func(**kwargs)

            # تخزين في الكاش
            _cache[cache_key] = {"result": result, "time": datetime.now()}

            latency = (time.time() - start) * 1000
            self._log_metric(user_id, tool_name, True, latency, message[:100], (result or "")[:200])
            return result

        except Exception as e:
            latency = (time.time() - start) * 1000
            self._log_metric(user_id, tool_name, False, latency, message[:100], error=str(e)[:200])
            logger.error(f"فشل تنفيذ {tool_name}: {e}")
            return None

    def _log_metric(self, user_id, tool_name, success, latency, input_text, output_text="", error=""):
        try:
            from .agent_metrics import agent_metrics
            import asyncio
            asyncio.create_task(agent_metrics.log_tool_execution(
                user_id=user_id, tool_name=tool_name, success=success,
                latency_ms=latency, input_query=input_text,
                output_summary=output_text, error_message=error
            ))
        except:
            pass

tool_executor = ToolExecutor()
