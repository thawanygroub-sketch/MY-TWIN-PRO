import os, logging, json, re
from typing import Dict, Any, Optional, List, Tuple
from tool_registry import ToolRegistry  # ✅ الاستيراد من الملف الجديد

logger = logging.getLogger("reasoning_engine")

class ReasoningEngine:
    def __init__(self):
        try:
            from multi_ai import MultiAIClient
            self.client = MultiAIClient()
        except:
            self.client = None

    def _extract_json(self, text: str) -> Optional[Dict]:
        if not text: return None
        text = text.strip()
        if text.startswith("```json"): text = text[7:]
        elif text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        try: return json.loads(text.strip())
        except: pass
        try:
            start = text.index('{')
            end = text.rindex('}') + 1
            return json.loads(text[start:end])
        except: pass
        try:
            from json_repair import repair_json
            return json.loads(repair_json(text))
        except: pass
        return None

    def _validate_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(plan.get("subgoals"), list): plan["subgoals"] = []
        if not isinstance(plan.get("needs_tool"), bool): plan["needs_tool"] = False
        if not isinstance(plan.get("tool_confidence"), (int, float)): plan["tool_confidence"] = 0.5
        if not isinstance(plan.get("needs_memory"), bool): plan["needs_memory"] = False
        if not isinstance(plan.get("response_style"), str): plan["response_style"] = "conversational"
        if not isinstance(plan.get("observation"), str): plan["observation"] = ""
        if not isinstance(plan.get("replan_if"), str): plan["replan_if"] = ""
        if not isinstance(plan.get("goal"), str): plan["goal"] = "general_chat"
        if not isinstance(plan.get("intent"), str): plan["intent"] = "general"
        return plan

    def _is_simple_chat(self, message: str) -> bool:
        simple_patterns = [
            "صباح الخير", "مساء الخير", "مرحبا", "هاي", "شكرا", "كيف حالك",
            "تمام", "حبيبي", "تسلم", "ولا يهمك", "hello", "hi", "thanks",
            "good morning", "good evening", "how are you", "bye", "سلام"
        ]
        msg_lower = message.lower().strip()
        return len(msg_lower) < 25 and any(pattern in msg_lower for pattern in simple_patterns)

    async def create_execution_plan(
        self, message: str, emotion: Dict[str, Any],
        user_id: Optional[str] = None, lang: str = "ar",
        context_summary: str = "", tier: str = "free"
    ) -> Dict[str, Any]:
        if self._is_simple_chat(message):
            return {
                "intent": "general_chat", "goal": "general_chat",
                "needs_tool": False, "primary_tool": None, "all_tools": [],
                "steps": [], "response_style": "conversational",
                "needs_memory": False, "tool_confidence": 1.0,
                "observation": "", "replan_if": "",
            }

        tools_desc = ToolRegistry.get_tool_descriptions(tier)
        tools_json = json.dumps(tools_desc, ensure_ascii=False)

        prompt = f"""أنت مخطط ذكي لرفيق AI. حلل الموقف وخطط للخطوات.
        
السياق الكامل:
{context_summary}

المشاعر الحالية: {emotion.get('primary', 'neutral')}

الأدوات المتاحة (مع وصفها):
{tools_json}

اختر أفضل أداة للهدف. إذا لم تكن هناك أداة مناسبة، اجعل needs_tool=false.
أعد ONLY JSON صالح بالهيكل التالي:
{{
  "intent": "weather/search/memory/emotional/general/...",
  "goal": "الهدف الرئيسي للمستخدم",
  "subgoals": ["خطوة 1", "خطوة 2"],
  "needs_tool": true/false,
  "primary_tool": "اسم الأداة المختارة أو null",
  "all_tools": ["primary_tool", "أدوات بديلة أخرى"],
  "tool_confidence": 0.0-1.0,
  "needs_memory": true/false,
  "response_style": "conversational/informative/supportive/coaching",
  "observation": "ما الذي يجب ملاحظته من نتيجة الأداة؟",
  "replan_if": "شرط إعادة التخطيط"
}}

رسالة المستخدم: "{message}"
JSON:"""

        if self.client:
            try:
                raw_reply = await self.client.get_best_reply(prompt, task="deep_reasoning")
                plan = self._extract_json(raw_reply)
                if plan:
                    plan = self._validate_plan(plan)
                    primary_tool = plan.get("primary_tool")
                    all_tools = plan.get("all_tools", [])
                    if not isinstance(all_tools, list): all_tools = [primary_tool] if primary_tool else []
                    if primary_tool and primary_tool not in all_tools: all_tools.insert(0, primary_tool)

                    available = ToolRegistry.list_tools()
                    filtered_all_tools = [t for t in all_tools if t in available]
                    if primary_tool and primary_tool not in filtered_all_tools:
                        primary_tool = None; plan["needs_tool"] = False

                    tool_confidence = float(plan.get("tool_confidence", 1.0))
                    if tool_confidence < 0.6 and plan.get("needs_tool"):
                        plan["needs_tool"] = False; primary_tool = None; filtered_all_tools = []

                    return {
                        "intent": plan.get("intent", "general"),
                        "goal": plan.get("goal", "general_chat"),
                        "subgoals": plan.get("subgoals", []),
                        "needs_tool": plan.get("needs_tool", False),
                        "primary_tool": primary_tool,
                        "all_tools": filtered_all_tools,
                        "steps": plan.get("subgoals", []),
                        "response_style": plan.get("response_style", "conversational"),
                        "needs_memory": plan.get("needs_memory", False),
                        "tool_confidence": tool_confidence,
                        "observation": plan.get("observation", ""),
                        "replan_if": plan.get("replan_if", ""),
                    }
            except Exception as e:
                logger.warning(f"Planner LLM failed, falling back to keyword detection: {e}")

        # Fallback بسيط
        intent = "general"
        msg_lower = message.lower()
        if any(kw in msg_lower for kw in ["طقس", "الجو", "الرياح", "مطر", "حرارة"]): intent = "weather"
        elif any(kw in msg_lower for kw in ["يوتيوب", "فيديو"]): intent = "video"
        elif any(kw in msg_lower for kw in ["أخبار", "news"]): intent = "news"
        elif any(kw in msg_lower for kw in ["عملة", "دولار", "ريال", "سعر"]): intent = "currency"
        elif any(kw in msg_lower for kw in ["أغنية", "موسيقى", "سبوتيفاي"]): intent = "music"
        elif any(kw in msg_lower for kw in ["بحث", "search", "google"]): intent = "search"
        elif any(kw in msg_lower for kw in ["هدف", "أهداف", "تقدم"]): intent = "goal"
        elif any(kw in msg_lower for kw in ["ذكرت", "قلت", "اتذكر", "remember"]): intent = "memory"
        elif any(kw in msg_lower for kw in ["حزين", "خايف", "قلق", "sad", "worried", "anxious"]): intent = "emotional"

        tool_map = {
            "weather": "get_weather", "video": "search_youtube", "news": "get_news",
            "currency": "get_currency", "music": "search_spotify", "search": "search_google",
            "goal": "remind_goal", "memory": "fetch_memory"
        }
        primary_tool = tool_map.get(intent) if intent in tool_map and tool_map[intent] in ToolRegistry.list_tools() else None
        return {
            "intent": intent, "goal": intent,
            "needs_tool": primary_tool is not None,
            "primary_tool": primary_tool,
            "all_tools": [primary_tool] if primary_tool else [],
            "steps": [], "response_style": "informative" if intent != "general" else "conversational",
            "needs_memory": intent in ["memory", "emotional"],
            "tool_confidence": 0.8, "observation": "", "replan_if": "",
        }

    async def plan(self, message, emotion):
        return await self.create_execution_plan(message, emotion)


reasoning_engine = ReasoningEngine()
print("✅ Reasoning Engine v5.7 (No Circular Import)")
