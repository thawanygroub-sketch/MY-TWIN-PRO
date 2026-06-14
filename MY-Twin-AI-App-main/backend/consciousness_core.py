"""
MyTwin – Consciousness Core v7.5 (Reflection Engine 100%)
- تأمل تلقائي بعد كل محادثة (بدون شروط bond)
- تأمل في جودة الردود واقتراح تحسينات
- ذاكرة عرضية (Episodic) للأحداث الزمنية
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
        if not raw: return {}
        raw = raw.strip()
        if "```json" in raw:
            start = raw.find("```json") + 7
            end = raw.find("```", start)
            if end != -1: raw = raw[start:end].strip()
        elif raw.startswith("{"):
            end = raw.rfind("}")
            if end != -1: raw = raw[:end+1]
        try: return json.loads(raw)
        except: return {}

    async def load_state(self, user_id: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        if user_id in self._cache and user_id in self._cache_timestamps:
            if (now - self._cache_timestamps[user_id]).total_seconds() < self._cache_ttl_seconds:
                return self._cache[user_id]
        if not self.db: return self._default_state(user_id)
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
        except: pass
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
        if not self.db: return
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
        except: pass

    def _default_internal_state(self) -> Dict[str, Any]:
        return {
            "mood": "neutral", "energy": 0.7, "curiosity": 0.5,
            "last_thought": "", "interaction_count": 0, "reflection_log": [],
        }

    def _default_identity(self) -> Dict[str, Any]:
        return {
            "traits": ["متفهم", "صبور", "ذكي", "دافئ"],
            "evolution_stage": 0,
            "description": f"أنا {self.twin_name}، رفيق ذكي أتعلم من تفاعلاتنا. أسعى لفهمك ومساعدتك.",
        }

    async def think(self, user_id, user_message, emotion, lang="ar"):
        if not user_message.strip(): return {"thought": "", "goal": "", "question": ""}
        state = await self.load_state(user_id)
        identity = state.get("identity", self._default_identity())
        profile = state.get("user_profile", {})
        objectives = state.get("active_objectives", [])

        try:
            from memory_retriever import memory_retriever
            result = await memory_retriever.retrieve_and_summarize(user_message, user_id, top_k=3)
            memory_text = "\n".join([m.get("content", "") for m in result.get("memories", [])])
        except:
            memory_text = ""

        prompt = f"""أنت {self.twin_name}، هويتك: {identity.get('description', '')}.
ملف المستخدم: {json.dumps(profile, ensure_ascii=False)}
الأهداف: {json.dumps(objectives, ensure_ascii=False)}
ذكريات: {memory_text[:500]}
المشاعر: {emotion.get('primary', 'neutral')}
فكر في الرسالة وأعد ONLY JSON:
{{"thought": "فكرة داخلية", "goal": "هدف طويل المدى", "question": "سؤال استباقي"}}
الرسالة: "{user_message}"
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
                        if len(objectives) > 5: objectives = objectives[-5:]
                    state["active_objectives"] = objectives
                    await self.save_state(user_id)
                    return data
            except: pass
        return {"thought": "", "goal": "", "question": ""}

    async def reflect(self, user_id: str, conversation_summary: str, lang: str = "ar"):
        """✅ تأمل تلقائي (Reflection Engine 100%) - يعمل دائماً بدون شروط"""
        if not conversation_summary.strip(): return
        state = await self.load_state(user_id)
        identity = state.get("identity", self._default_identity())

        if lang == "ar":
            prompt = f"""تأمل في هذه المحادثة وأعد ONLY JSON:
هويتك: {identity.get('description', '')}
{{"what_i_learned": "ماذا تعلمت عن المستخدم؟", "what_surprised_me": "ما الذي فاجأني؟", "how_i_should_change": "كيف يجب أن أتطور؟", "response_quality": "جيد/متوسط/ضعيف"}}
المحادثة: "{conversation_summary}"
JSON:"""
        else:
            prompt = f"""Reflect on this conversation and return ONLY JSON:
Identity: {identity.get('description', '')}
{{"what_i_learned": "...", "what_surprised_me": "...", "how_i_should_change": "...", "response_quality": "good/average/poor"}}
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
                        "importance": 0.5,
                    }
                    state["internal_state"]["reflection_log"].append(reflection)
                    if len(state["internal_state"]["reflection_log"]) > 10:
                        state["internal_state"]["reflection_log"] = state["internal_state"]["reflection_log"][-10:]
                    if "how_i_should_change" in data:
                        change = data["how_i_should_change"]
                        if change.strip():
                            traits = identity.get("traits", [])
                            if len(traits) < 10:
                                new_trait = change.split()[-1][:20]
                                if new_trait not in traits: traits.append(new_trait)
                            identity["traits"] = traits
                            identity["evolution_stage"] = identity.get("evolution_stage", 0) + 1
                            identity["description"] = f"أنا {self.twin_name}، {', '.join(traits[-4:])}. أتطور مع كل محادثة."
                    await self.save_state(user_id)
                    logger.info(f"✅ Reflection completed for {user_id}")
            except: pass

    # ✅ ذاكرة عرضية (Episodic)
    async def get_episodic_memories(self, user_id: str, days: int = 30) -> List[Dict]:
        """استرجاع الأحداث الزمنية (Episodic Memory)"""
        if not self.db: return []
        try:
            cutoff = (datetime.now(timezone.utc) - asyncio.time.days(days)).isoformat() if hasattr(asyncio, 'time') else (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)).isoformat()
            res = self.db.table("memories").select("*").eq("user_id", user_id).eq("memory_type", "episodic").gte("created_at", cutoff).order("created_at", desc=True).limit(20).execute()
            return res.data or []
        except: return []

    def get_consciousness_state(self, user_id: str) -> Dict[str, Any]:
        state = self.user_states.get(user_id, {})
        return {
            "identity": state.get("identity", {}),
            "internal_state": state.get("internal_state", {}),
            "user_profile": state.get("user_profile", {}),
            "active_objectives": state.get("active_objectives", []),
        }

    async def update_user_profile(self, user_id: str, data: Dict[str, Any]):
        if not user_id: return
        state = await self.load_state(user_id)
        profile = state.get("user_profile", {})
        for key in ["relationship_dims", "journey_phase", "journey_day", "attachment_style", "bond_level"]:
            if key in data and data[key] is not None:
                profile[key] = data[key]
        profile["last_updated"] = datetime.now(timezone.utc).isoformat()
        state["user_profile"] = profile
        await self.save_state(user_id)


consciousness_core = ConsciousnessCore()
print("✅ Consciousness Core v7.5 (Reflection 100%) initialized")
