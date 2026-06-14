import logging
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

class ToolRegistry:
    _tools: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register(cls, name: str, func: Callable, priority: int = 5, cost: int = 1, category: str = "general", description: str = ""):
        cls._tools[name] = {
            "function": func,
            "priority": priority,
            "cost": cost,
            "category": category,
            "description": description
        }

    @classmethod
    def get_tool(cls, name: str) -> Optional[Callable]:
        tool = cls._tools.get(name)
        return tool["function"] if tool else None

    @classmethod
    def list_tools(cls) -> list:
        return list(cls._tools.keys())

    @classmethod
    def get_tool_descriptions(cls, tier: str = "free") -> Dict[str, str]:
        descriptions = {}
        for name, info in cls._tools.items():
            if tier in ["free", "plus"] and info.get("cost", 1) > 2:
                continue
            descriptions[name] = info.get("description", "")
        return descriptions

# تسجيل الأدوات الداخلية (التي لا تعتمد على خدمات خارجية)
async def _tool_remind_goal(user_id: str, query: str = "") -> Optional[str]:
    try:
        from supabase import create_client
        import os
        url = os.getenv("SUPABASE_URL", ""); key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key: return None
        db = create_client(url, key)
        res = db.table("goals").select("*").eq("user_id", user_id).eq("status", "active").order("created_at", desc=True).limit(3).execute()
        if res.data: return "أهدافك النشطة: " + "، ".join(g.get("title", "") for g in res.data)
        return "لا توجد أهداف نشطة حالياً."
    except Exception as e:
        logger.warning(f"Tool remind_goal failed: {e}")
        return None

async def _tool_fetch_memory(user_id: str, query: str = "") -> Optional[str]:
    try:
        from memory_graph import get_memory_context
        context = await get_memory_context(user_id)
        if context and query.lower() in str(context).lower(): return str(context)
        return "لا توجد ذكريات تطابق البحث."
    except Exception as e:
        logger.warning(f"Tool fetch_memory failed: {e}")
        return None

ToolRegistry.register("remind_goal", _tool_remind_goal, 9, 1, "memory", "استرجاع أهداف المستخدم النشطة")
ToolRegistry.register("fetch_memory", _tool_fetch_memory, 8, 1, "memory", "استرجاع ذكريات محددة من الماضي")

# تسجيل الأدوات الخارجية (مع استيراد آمن)
try:
    from tools.external_services import (
        search_google, search_youtube, search_spotify,
        get_weather, get_news, get_currency,
        home_assistant_control
    )
    ToolRegistry.register("search_google", search_google, 8, 2, "search", "البحث في الإنترنت عن معلومات عامة")
    ToolRegistry.register("search_youtube", search_youtube, 7, 2, "search", "البحث عن فيديوهات في يوتيوب")
    ToolRegistry.register("search_spotify", search_spotify, 6, 2, "search", "البحث عن أغاني أو موسيقى في سبوتيفاي")
    ToolRegistry.register("get_weather", get_weather, 9, 1, "utility", "معرفة حالة الطقس في مدينة معينة")
    ToolRegistry.register("get_news", get_news, 7, 1, "utility", "جلب آخر الأخبار والمستجدات")
    ToolRegistry.register("get_currency", get_currency, 6, 1, "utility", "معرفة أسعار صرف العملات")
    ToolRegistry.register("home_assistant_control", home_assistant_control, 5, 3, "smart_home", "التحكم في أجهزة المنزل الذكي مثل الإضاءة")
    logger.info("✅ External tools registered in ToolRegistry")
except ImportError as e:
    logger.warning(f"External services not available: {e}")

print("✅ Tool Registry initialized")
