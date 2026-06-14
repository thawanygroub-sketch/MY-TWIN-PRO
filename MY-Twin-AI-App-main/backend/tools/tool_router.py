"""
MyTwin – Tool Router v3.0 (Unified + Confidence + Budget + Cache)
- يستخدم primary_tool و all_tools من Reasoning Engine
- يطبق Tool Confidence Filter
- يطبق Agent Budget
- يمرر عبر Tool Executor (الذي فيه كاش)
"""
import logging, time
from typing import Optional, Dict, Any
from reasoning_engine import reasoning_engine
from .tool_executor import tool_executor
from .agent_budget import agent_budget

logger = logging.getLogger("tool_router")

class ToolRouter:
    async def route(self, message: str, user_id: str, tier: str = "free",
                    user_profile: Optional[Dict[str, Any]] = None,
                    emotion: Optional[Dict[str, Any]] = None) -> Optional[str]:
        if not message:
            return None

        # 1. التخطيط
        emotion_data = emotion or {"primary": "neutral", "intensity": 0.5}
        plan = await reasoning_engine.create_execution_plan(
            message=message, emotion=emotion_data, user_id=user_id, tier=tier
        )

        # 2. ✅ توحيد استخراج الأدوات (حل المشكلة الأولى)
        selected_tools = []
        if plan.get("all_tools"):
            selected_tools = plan["all_tools"]
        elif plan.get("primary_tool"):
            selected_tools = [plan["primary_tool"]]

        # 3. ✅ Tool Confidence Filter (حل المشكلة السابعة)
        if plan.get("tool_confidence", 1.0) < 0.6:
            logger.info(f"⏭️ تخطي: ثقة الأداة منخفضة ({plan.get('tool_confidence')})")
            return None

        if not selected_tools:
            return await self._manual_route(message, user_id, tier, user_profile)

        # 4. التنفيذ عبر Tool Executor (الذي فيه كاش)
        for tool_name in selected_tools:
            # ✅ Budget Check (حل المشكلة السادسة)
            if not agent_budget.can_execute(tool_name, 0, 0, 0, tier):
                logger.info(f"⏭️ تخطي {tool_name}: تجاوز الميزانية")
                continue

            result = await tool_executor.execute(
                tool_name=tool_name,
                message=message,
                user_id=user_id,
                tier=tier,
                user_profile=user_profile
            )
            if result:
                return result

        return None

    async def _manual_route(self, message, user_id, tier, profile):
        # الاحتياطي اليدوي (لم يتغير)
        msg = message.lower()
        if any(kw in msg for kw in ["طقس", "الجو", "weather"]):
            return await tool_executor.execute("get_weather", message, user_id, tier, profile)
        if any(kw in msg for kw in ["يوتيوب", "youtube", "فيديو"]):
            return await tool_executor.execute("search_youtube", message, user_id, tier, profile)
        if any(kw in msg for kw in ["أخبار", "news"]):
            return await tool_executor.execute("get_news", message, user_id, tier, profile)
        if any(kw in msg for kw in ["عملة", "دولار", "سعر", "currency"]):
            return await tool_executor.execute("get_currency", message, user_id, tier, profile)
        if any(kw in msg for kw in ["أغنية", "موسيقى", "سبوتيفاي"]):
            return await tool_executor.execute("search_spotify", message, user_id, tier, profile)
        if any(kw in msg for kw in ["بحث", "search", "google"]):
            return await tool_executor.execute("search_google", message, user_id, tier, profile)
        if any(kw in msg for kw in ["هدف", "أهداف", "تقدم"]):
            return await tool_executor.execute("remind_goal", message, user_id, tier, profile)
        return None

tool_router = ToolRouter()
print("✅ Tool Router v3.0 (Unified + Confidence + Budget + Cache)")
