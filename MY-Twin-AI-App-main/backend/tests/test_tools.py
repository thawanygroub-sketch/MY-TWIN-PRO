import pytest
import asyncio
import os

os.environ["SUPABASE_URL"] = "http://localhost"
os.environ["SUPABASE_SERVICE_KEY"] = "test"
os.environ["GEMINI_API_KEY"] = "test"

from reasoning_engine import ToolRegistry
from tools.tool_router import tool_router
from tools.agent_loop import agent_loop
from tools.tool_executor import tool_executor
from tools.tool_argument_builder import tool_argument_builder

# ========== أدوات مساعدة للاختبار ==========
def _is_external_tool_available(tool_name: str) -> bool:
    """التحقق من أن الأداة الخارجية مسجلة بالفعل (وليس فقط الأدوات الداخلية)"""
    return tool_name in ToolRegistry.list_tools()

# ========== Tool Registry ==========
def test_tool_registry_has_internal_tools():
    """الأدوات الداخلية يجب أن تكون موجودة دائماً"""
    tools = ToolRegistry.list_tools()
    assert "remind_goal" in tools
    assert "fetch_memory" in tools

def test_tool_registry_has_external_tools():
    """الأدوات الخارجية يجب أن تكون موجودة إذا نجح استيرادها"""
    tools = ToolRegistry.list_tools()
    # نتحقق فقط إذا كانت الأدوات الخارجية متاحة
    if _is_external_tool_available("search_google"):
        assert "get_weather" in tools
        assert "search_google" in tools
        assert "search_youtube" in tools
        assert "get_news" in tools
        assert "get_currency" in tools
    else:
        pytest.skip("الأدوات الخارجية غير متاحة في بيئة الاختبار")

def test_tool_registry_get_valid_internal_tool():
    """أداة داخلية يجب أن تكون موجودة"""
    func = ToolRegistry.get_tool("remind_goal")
    assert func is not None
    assert callable(func)

def test_tool_registry_get_external_tool():
    """أداة خارجية يجب أن تكون موجودة إذا نجح استيرادها"""
    if _is_external_tool_available("search_google"):
        func = ToolRegistry.get_tool("get_weather")
        assert func is not None
        assert callable(func)
    else:
        pytest.skip("الأدوات الخارجية غير متاحة")

def test_tool_registry_get_invalid_tool():
    """أداة غير موجودة يجب أن ترجع None"""
    func = ToolRegistry.get_tool("non_existent_tool")
    assert func is None

# ========== Tool Argument Builder ==========
def test_argument_builder_weather():
    args = tool_argument_builder.build_args("get_weather", "ما هو الطقس في القاهرة؟", "user1")
    assert args["city"] == "القاهرة"

def test_argument_builder_search_google():
    args = tool_argument_builder.build_args("search_google", "ابحث عن الذكاء الاصطناعي", "user1")
    assert "الذكاء الاصطناعي" in args["query"]

def test_argument_builder_extract_city():
    city = tool_argument_builder._extract_city("الطقس في لندن اليوم")
    assert city == "لندن"

def test_argument_builder_extract_query():
    query = tool_argument_builder._extract_query("ابحث في جوجل عن محمد صلاح", "search_google")
    assert "محمد صلاح" in query

def test_argument_builder_currency():
    args = tool_argument_builder.build_args("get_currency", "كم سعر الدولار؟", "user1")
    assert args["base"] == "USD"

def test_argument_builder_news():
    args = tool_argument_builder.build_args("get_news", "آخر الأخبار", "user1")
    assert args["country"] == "sa"

# ========== Tool Router ==========
def test_tool_router_weather_detection():
    result = asyncio.run(tool_router.route("ما هو الطقس في القاهرة؟", "test_user"))
    assert result is None

def test_tool_router_search_detection():
    result = asyncio.run(tool_router.route("ابحث عن تاريخ مصر", "test_user"))
    assert result is None

# ========== Agent Loop ==========
def test_agent_loop_empty_plan():
    plan = {"needs_tool": False, "goal": "general_chat", "primary_tool": None, "all_tools": []}
    result = asyncio.run(agent_loop.execute(plan=plan, user_id="test", message="مرحبا", emotion={"primary": "neutral"}))
    assert "reply" in result
    assert len(result["reply"]) > 0

def test_agent_loop_weather_plan():
    if not _is_external_tool_available("get_weather"):
        pytest.skip("أداة الطقس غير متاحة")
    plan = {"needs_tool": True, "goal": "weather", "primary_tool": "get_weather", "all_tools": ["get_weather"], "tool_confidence": 0.9, "steps": []}
    result = asyncio.run(agent_loop.execute(plan=plan, user_id="test", message="طقس القاهرة", emotion={"primary": "neutral"}))
    assert "reply" in result

def test_agent_loop_replan_condition():
    plan = {"needs_tool": True, "goal": "test", "primary_tool": "get_weather", "all_tools": ["get_weather"], "tool_confidence": 0.9, "replan_if": "خطأ", "steps": []}
    result = asyncio.run(agent_loop.execute(plan=plan, user_id="test", message="test", emotion={"primary": "neutral"}))
    assert "reply" in result
