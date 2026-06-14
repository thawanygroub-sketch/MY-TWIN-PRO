import os, random, logging, time, asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime
from multi_ai import MultiAIClient, AIUnavailable
from emotional_engine import EmotionalStateTracker
from dialect_engine import get_dialect_for_user, get_dialect_prompt
from reasoning_engine import ReasoningEngine
from memory_graph import store_mem, extract_entities
from relationship_engine import RelationshipEngine
from prompt_builder import PromptBuilder
from consciousness_core import ConsciousnessCore
from growth_tracker import track_growth
from twin_journey import twin_journey
from attachment_engine import attachment_engine
from safety_engine import safety_engine
from product_recommender import product_recommender
from tools.tool_router import tool_router
from context_manager import context_manager
from tools.agent_loop import agent_loop
from response_validator import response_validator
from memory_summarizer import memory_summarizer
from tools.agent_metrics import agent_metrics

logger = logging.getLogger("twin_brain")

class TwinBrain:
    EMOJI_MAP = {
        "joy": ["😊", "😄", "💫", "✨", "🌟", "🥳", "🎉", "💖"],
        "sadness": ["💜", "🫂", "🌧️", "💙", "🤗", "🌸"],
        "anger": ["😤", "🔥", "⚡", "🧘", "🌿"],
        "fear": ["🫶", "💜", "🤝", "✨"],
        "love": ["💕", "💝", "💌", "🫶", "💖", "🌸"],
        "surprise": ["😮", "🤩", "💡", "🎯", "🔮", "✨"],
        "neutral": ["💜", "✨", "🤍", "🌙"],
        "support": ["💪", "🤝", "🫶", "✨", "🌟"],
    }

    FALLBACK_REPLIES = [
        "والله إني معاك، كمل كلامك متوقفش 💜",
        "حاسس بيك، إيه اللي شاغل بالك بالظبط؟",
        "يا صاحبي أنا جنبك، قولي كل حاجة 🫶",
        "أنا سامعك، وعارف إنك تقدر تعدي أي حاجة ✨",
        "أفهمك والله، أنا معاك في اللي بتمر بيه 💜",
        "كلامك مهم جداً بالنسبة لي، كمّل 🌸",
    ]

    def __init__(self, gemini_key=None):
        self.multi = MultiAIClient()
        self.emotion_tracker = EmotionalStateTracker()
        self.reasoning_engine = ReasoningEngine()
        self.relationship = RelationshipEngine()
        self.prompt_builder = PromptBuilder()
        self.consciousness = ConsciousnessCore(twin_name="MyTwin")
        self.twin_name = "MyTwin"
        self.user_join_dates = {}

    async def detect_emotion(self, text: str) -> Dict[str, Any]:
        return await self.emotion_tracker.analyze(text)

    def _pick_emoji(self, primary_emotion: str) -> str:
        emojis = self.EMOJI_MAP.get(primary_emotion, self.EMOJI_MAP["neutral"])
        return random.choice(emojis)

    async def respond(self, message, twin_name, bond_level, dims, memories, history,
                      calm=False, personality=None, country_code="SA", user_id=None, tier="free",
                      join_date=None, recent_messages=None, user_profile=None):
        
        # 1. فحص الأمان (سريع، لا يؤثر على الأداء)
        safety_check = safety_engine.check_safety(message)
        if not safety_check["safe"] and safety_check["severity"] == "critical":
            return {
                "reply": safety_engine.HELPLINE_MESSAGE, "new_bond": bond_level,
                "emotion": {"primary": "concern", "intensity": 1.0}, "provider": "safety_engine",
                "latency_ms": 0, "dialect": get_dialect_for_user(country_code, message), "safety_alert": True
            }

        # 2. تحليل المشاعر واللغة (متوازي)
        emotion_task = asyncio.create_task(self.detect_emotion(message))
        dialect = get_dialect_for_user(country_code, message)
        dialect_prompt = get_dialect_prompt(dialect)
        emotion = await emotion_task

        # 3. توجيه الأدوات السريع (Pre-LLM)
        if user_id:
            try:
                tool_result = await tool_router.route(
                    message=message, user_id=user_id, tier=tier, emotion=emotion
                )
                if tool_result:
                    logger.info(f"🔧 أداة سريعة: {tool_result[:100]}...")
                    await agent_metrics.log_tool_execution(
                        user_id=user_id, tool_name="tool_router", success=True,
                        latency_ms=0, input_query=message[:100], output_summary=tool_result[:100]
                    )
                    return {
                        "reply": tool_result, "new_bond": bond_level, "emotion": emotion,
                        "provider": "tool", "latency_ms": 0, "dialect": dialect,
                        "journey_phase": "active", "attachment_style": "unknown",
                        "relationship_dims": dims or {}, "energy": 80, "thinking_stage": "completed",
                    }
            except Exception as e:
                logger.warning(f"Tool routing failed: {e}")

        # 4. بناء السياق + العلاقة (متوازي)
        context_task = asyncio.create_task(
            context_manager.build_context(user_id=user_id, message=message, emotion=emotion, history=history, lang="ar", tier=tier, user_profile=user_profile)
        ) if user_id else None

        journey_info, attachment_info = {}, {}
        if user_id:
            try:
                journey_info = twin_journey.get_daily_activity(user_id, join_date) if join_date else {}
                if recent_messages:
                    emotion_history = [emotion] if emotion else []
                    memory_context_data = {"memories": []}
                    attachment_info = await attachment_engine.detect_attachment_style(
                        user_id=user_id, messages=recent_messages, emotion_history=emotion_history, memory_context=memory_context_data
                    )
                self.relationship.update(emotion=emotion, message=message,
                    journey_phase=journey_info.get("phase"), attachment_style=attachment_info.get("style"),
                    memory_importance=emotion.get("intensity", 0.5))
            except Exception as e:
                logger.warning(f"Relationship update failed: {e}")

        full_context = await context_task if context_task else {}
        context_summary = full_context.get("planner_summary", "")

        # 5. التخطيط
        plan = await self.reasoning_engine.create_execution_plan(
            message=message, emotion=emotion, user_id=user_id, lang="ar", context_summary=context_summary, tier=tier
        ) if user_id else {"needs_tool": False, "goal": "general_chat"}

        # 6. تنفيذ الـ Agent Loop (ReAct)
        final_reply, provider, tool_results = None, "multi_ai", []
        if plan.get("needs_tool") and plan.get("tool_confidence", 0) >= 0.6:
            try:
                agent_response = await agent_loop.execute(
                    plan=plan, user_id=user_id, message=message, emotion=emotion,
                    twin_brain_instance=self, context_summary=context_summary, lang="ar"
                )
                if agent_response and agent_response.get("reply"):
                    final_reply = agent_response.get("reply")
                    provider = agent_response.get("provider", "agent_loop")
                    tool_results = agent_response.get("tool_results", [])
            except Exception as e:
                logger.error(f"Agent loop failed: {e}")

        # 7. LLM (إذا لم يتم توليد رد)
        if not final_reply:
            rel_stage = self.relationship.get_stage_instruction()
            relationship_for_prompt = {"label": rel_stage.get("label", "Friend"), "bond_level": bond_level, "instruction": "Be supportive."}
            formatted_context = context_manager.format_context_for_prompt(full_context)
            prompt = await self.prompt_builder.build(
                twin_name=twin_name, user_name="صديقي", relationship=relationship_for_prompt,
                emotion=emotion, voice={"style": "Warm", "pitch": 1.0, "rate": 1.0},
                dialect={"dialect": dialect, "instruction": dialect_prompt},
                user_id=user_id, journey_info=journey_info, attachment_info=attachment_info,
                response_adjustments={}, message=message,
                memory_context=formatted_context, reasoning_result=plan,
                consciousness_context=full_context.get("consciousness", {}),
            )
            start = time.time()
            try:
                reply = await self.multi.get_best_reply(prompt)
                provider = "multi_ai"
            except AIUnavailable:
                reply = random.choice(self.FALLBACK_REPLIES)
                provider = "fallback"
            latency = (time.time() - start) * 1000
            if reply and not any(emoji in reply for emoji in ["😊", "💜", "✨"]):
                reply = reply.strip() + " " + self._pick_emoji(emotion.get("primary", "neutral"))
            final_reply = reply

        # 8. Response Validator
        validation = response_validator.validate(reply=final_reply, context=full_context, tool_results=tool_results, emotion=emotion)
        if validation.get("repaired"): final_reply = validation.get("final_reply", final_reply)
        if not validation.get("valid", True): final_reply = "أنا هنا لدعمك، لكن لا يمكنني الرد على هذا. 💜"; provider = "safety_validator"

        # 9. Post-processing (متوازي)
        if user_id:
            asyncio.create_task(store_mem(user_id, message, emotion.get("intensity", 0.5), emotion.get("primary", "neutral")))
            asyncio.create_task(extract_entities(user_id, message))
            asyncio.create_task(track_growth(user_id, {"journey_phase": journey_info.get("phase", "unknown"), "attachment_style": attachment_info.get("style", "unknown"), "emotion": emotion.get("primary", "neutral")}))
            asyncio.create_task(memory_summarizer.increment_counter(user_id))
            if await memory_summarizer.should_summarize(user_id):
                asyncio.create_task(memory_summarizer.summarize_and_store(user_id=user_id, messages=history or [], twin_brain_instance=self))
            asyncio.create_task(self.consciousness.update_user_profile(user_id, {"relationship_dims": self.relationship.dims, "journey_phase": journey_info.get("phase"), "journey_day": journey_info.get("day"), "attachment_style": attachment_info.get("style"), "bond_level": self.relationship.bond_level}))
            if self.relationship.bond_level > 30:
                asyncio.create_task(self.consciousness.reflect(user_id=user_id, conversation_summary=message[:200], lang="ar"))

        return {
            "reply": final_reply, "new_bond": self.relationship.bond_level, "emotion": emotion,
            "provider": provider, "dialect": dialect,
            "journey_phase": journey_info.get("phase", "unknown"), "journey_day": journey_info.get("day", 1),
            "attachment_style": attachment_info.get("style", "unknown"),
            "relationship_dims": self.relationship.dims
        }

twin_brain = TwinBrain()
