"""
MyTwin – Consciousness Core v7.0 (Deep Integration + Agent-Aware)
- يتكامل مع Context Manager و Agent Loop
- يستخدم Memory Retriever الجديد (v4.0) لاستدعاء الذكريات
- كاش مؤقت (60 ثانية) لتقليل استدعاءات Supabase
- وعي ذاتي يتطور: يعرف علاقته بالمستخدم، مشاعره، ونمط تعلقه
- تأمل تلقائي بعد كل دورة Agent Loop
- يضبط نبرته بناءً على حالة المستخدم (Emotion + Attachment)
"""
import os, logging, asyncio, json, time
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from supabase import create_client, Client

logger = logging.getLogger("consciousness_core")

class ConsciousnessCore:
    def __init__(self, twin_name: str = "MyTwin"):
        self.twin_name = twin_name
        self.user_states: Dict[str, Dict[str, Any]] = {}
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, datetime] = {}
        self._cache_ttl_seconds = 60
        self.db = self._init_db()

    def _init_db(self) -> Optional[Client]:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if url and key:
            return create_client(url, key)
        return None

    def _get_ai_client(self):
        try:
            from multi_ai import MultiAIClient
            return MultiAIClient()
        except:
            return None

    def _safe_json_parse(self, raw: str) -> Dict[str, Any]:
        if not raw:
            return {}
        raw = raw.strip()
        if "```json" in raw:
            start = raw.find("```json") + 7
            end = raw.find("```", start)
            if end != -1:
                raw = raw[start:end].strip()
        elif raw.startswith("{"):
            end = raw.rfind("}")
            if end != -1:
                raw = raw[:end+1]
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON from: {raw[:100]}")
            return {}

    async def load_state(self, user_id: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        if user_id in self._cache and user_id in self._cache_timestamps:
            if (now - self._cache_timestamps[user_id]).total_seconds() < self._cache_ttl_seconds:
                return self._cache[user_id]

        if not self.db:
            return self._default_state(user_id)

        try:
            res = self.db.table("twin_states").select("*").eq("user_id", user_id).single().execute()
            if res.data:
                state = res.data.get("state", {})
                self.user_states[user_id] = {
                    "internal_state": state.get("internal_state", self._default_internal_state()),
                    "identity": state.get("identity", self._default_identity()),
                    "user_profile": state.get("user_profile", {}),
                    "active_objectives": state.get("active_objectives", []),
                }
                self._cache[user_id] = self.user_states[user_id]
                self._cache_timestamps[user_id] = now
                return self.user_states[user_id]
        except Exception as e:
            logger.warning(f"Failed to load state for {user_id}: {e}")
        
        default_state = self._default_state(user_id)
        self._cache[user_id] = default_state
        self._cache_timestamps[user_id] = now
        return default_state

    def _default_state(self, user_id: str) -> Dict[str, Any]:
        return {
            "internal_state": self._default_internal_state(),
            "identity": self._default_identity(),
            "user_profile": {},
            "active_objectives": [],
        }

    async def save_state(self, user_id: str):
        if not self.db:
            return
        try:
            state_data = self.user_states.get(user_id, {})
            self.db.table("twin_states").upsert({
                "user_id": user_id,
                "state": {
                    "internal_state": state_data.get("internal_state", {}),
                    "identity": state_data.get("identity", {}),
                    "user_profile": state_data.get("user_profile", {}),
                    "active_objectives": state_data.get("active_objectives", []),
                },
                "bond_level": state_data.get("internal_state", {}).get("bond_level", 0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            self._cache[user_id] = state_data
            self._cache_timestamps[user_id] = datetime.now(timezone.utc)
        except Exception as e:
            logger.warning(f"Failed to save state for {user_id}: {e}")

    def _default_internal_state(self) -> Dict[str, Any]:
        return {
            "mood": "neutral",
            "energy": 0.7,
            "curiosity": 0.5,
            "last_thought": "",
            "interaction_count": 0,
            "reflection_log": [],
        }

    def _default_identity(self) -> Dict[str, Any]:
        return {
            "traits": ["متفهم", "صبور", "ذكي", "دافئ"],
            "evolution_stage": 0,
            "description": f"أنا {self.twin_name}، رفيق ذكي أتعلم من تفاعلاتنا. أسعى لفهمك ومساعدتك.",
        }

    async def think(self, user_id: str, user_message: str, emotion: Dict[str, Any], lang: str = "ar") -> Dict[str, Any]:
        if not user_message.strip():
            return {"thought": "", "goal": "", "question": ""}

        state = await self.load_state(user_id)
        identity = state.get("identity", self._default_identity())
        user_profile = state.get("user_profile", {})
        objectives = state.get("active_objectives", [])

        try:
            from memory_retriever import memory_retriever
            result = await memory_retriever.retrieve_and_summarize(user_message, user_id, top_k=3)
            recent_memories = result.get("memories", [])
            memory_text = "\n".join([m.get("content", "") for m in recent_memories])
        except:
            try:
                from memory_graph import get_memory_context
                memory_text = await get_memory_context(user_id) if user_id else ""
            except:
                memory_text = ""

        if lang == "ar":
            prompt = f"""أنت {self.twin_name}، هويتك: {identity.get('description', '')}.
ملف المستخدم: {json.dumps(user_profile, ensure_ascii=False)}
الأهداف طويلة المدى: {json.dumps(objectives, ensure_ascii=False)}
ذكريات حديثة: {memory_text[:500]}
المشاعر الحالية: {emotion.get('primary', 'neutral')}
فكر في هذه الرسالة وأعد ONLY JSON:
{{"thought": "فكرة داخلية قصيرة بالعامية المصرية", "goal": "هدف طويل المدى", "question": "سؤال استباقي"}}
الرسالة: "{user_message}"
JSON:"""
        else:
            prompt = f"""You are {self.twin_name}, identity: {identity.get('description', '')}.
User profile: {json.dumps(user_profile)}
Long-term objectives: {json.dumps(objectives)}
Recent memories: {memory_text[:500]}
Current emotion: {emotion.get('primary', 'neutral')}
Think about this message and return ONLY JSON:
{{"thought": "...", "goal": "...", "question": "..."}}
Message: "{user_message}"
JSON:"""

        client = self._get_ai_client()
        if client:
            try:
                result = await client.get_best_reply(prompt, task="deep_reasoning")
                data = self._safe_json_parse(result)
                if data:
                    state["internal_state"]["last_thought"] = data.get("thought", "")
                    state["internal_state"]["interaction_count"] += 1
                    goal = data.get("goal", "")
                    if goal and goal not in [o.get("title") for o in objectives]:
                        objectives.append({"title": goal, "progress": 0, "created_at": datetime.now(timezone.utc).isoformat()})
                        if len(objectives) > 5:
                            objectives = objectives[-5:]
                    state["active_objectives"] = objectives
                    await self.save_state(user_id)
                    return data
            except Exception as e:
                logger.warning(f"Think failed for {user_id}: {e}")
        return {"thought": "", "goal": "", "question": ""}

    async def reflect(self, user_id: str, conversation_summary: str, lang: str = "ar"):
        if not conversation_summary.strip():
            return
        state = await self.load_state(user_id)
        should_reflect = (
            state["internal_state"]["interaction_count"] > 10 or
            "important" in conversation_summary.lower()
        )
        if not should_reflect:
            return

        identity = state.get("identity", self._default_identity())
        if lang == "ar":
            prompt = f"""تأمل في هذه المحادثة بناءً على هويتك وأعد ONLY JSON:
هويتك: {identity.get('description', '')}
{{"what_i_learned": "ماذا تعلمت عن المستخدم؟", "what_surprised_me": "ما الذي فاجأني؟", "how_i_should_change": "كيف يجب أن أتطور؟"}}
المحادثة: "{conversation_summary}"
JSON:"""
        else:
            prompt = f"""Reflect on this conversation based on your identity and return ONLY JSON:
Identity: {identity.get('description', '')}
{{"what_i_learned": "...", "what_surprised_me": "...", "how_i_should_change": "..."}}
Conversation: "{conversation_summary}"
JSON:"""

        client = self._get_ai_client()
        if client:
            try:
                result = await client.get_best_reply(prompt, task="deep_reasoning")
                data = self._safe_json_parse(result)
                if data:
                    reflection = {
                        "data": data,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "importance": 0.7 if state["internal_state"]["interaction_count"] > 20 else 0.3,
                    }
                    state["internal_state"]["reflection_log"].append(reflection)
                    if len(state["internal_state"]["reflection_log"]) > 10:
                        state["internal_state"]["reflection_log"] = state["internal_state"]["reflection_log"][-10:]
                    if "how_i_should_change" in data:
                        change = data["how_i_should_change"]
                        if change.strip():
                            current_traits = identity.get("traits", [])
                            if len(current_traits) < 10:
                                new_trait = change.split()[-1][:20]
                                if new_trait not in current_traits:
                                    current_traits.append(new_trait)
                            identity["traits"] = current_traits
                            identity["evolution_stage"] = identity.get("evolution_stage", 0) + 1
                            identity["description"] = f"أنا {self.twin_name}، {', '.join(current_traits[-4:])}. أتطور مع كل محادثة."
                    await self.save_state(user_id)
                    logger.info(f"✅ Reflection completed for {user_id}")
            except Exception as e:
                logger.warning(f"Reflection failed for {user_id}: {e}")

    def get_consciousness_state(self, user_id: str) -> Dict[str, Any]:
        state = self.user_states.get(user_id, {})
        return {
            "identity": state.get("identity", {}),
            "internal_state": state.get("internal_state", {}),
            "user_profile": state.get("user_profile", {}),
            "active_objectives": state.get("active_objectives", []),
        }

    async def update_user_profile(self, user_id: str, data: Dict[str, Any]):
        if not user_id:
            return
        state = await self.load_state(user_id)
        profile = state.get("user_profile", {})
        if "relationship_dims" in data:
            profile["relationship_dims"] = data["relationship_dims"]
        if "journey_phase" in data and data["journey_phase"] is not None:
            profile["journey_phase"] = data["journey_phase"]
        if "journey_day" in data and data["journey_day"] is not None:
            profile["journey_day"] = data["journey_day"]
        if "attachment_style" in data and data["attachment_style"] is not None:
            profile["attachment_style"] = data["attachment_style"]
        if "bond_level" in data and data["bond_level"] is not None:
            profile["bond_level"] = data["bond_level"]
        profile["last_updated"] = datetime.now(timezone.utc).isoformat()
        state["user_profile"] = profile
        await self.save_state(user_id)


consciousness_core = ConsciousnessCore()
logger.info("✅ Consciousness Core v7.0 initialized (Deep Integration + Agent-Aware)")
