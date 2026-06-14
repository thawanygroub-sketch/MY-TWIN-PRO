"""
MyTwin – Memory Summarizer v1.0 (Long-Term Memory Compression)
- يلخص المحادثات الطويلة ويحولها إلى ذكريات دائمة
- يقلل تكلفة الـ API ويحافظ على السياق العميق
- يتكامل مع twin_brain و agent_loop
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger("memory_summarizer")

class MemorySummarizer:
    def __init__(self, max_messages_before_summary: int = 50):
        self.max_messages = max_messages_before_summary
        self.message_counters: Dict[str, int] = {}

    async def should_summarize(self, user_id: str) -> bool:
        """التحقق من وصول عدد الرسائل إلى الحد المطلوب"""
        count = self.message_counters.get(user_id, 0)
        return count >= self.max_messages

    async def increment_counter(self, user_id: str):
        self.message_counters[user_id] = self.message_counters.get(user_id, 0) + 1

    async def reset_counter(self, user_id: str):
        self.message_counters[user_id] = 0

    async def summarize_and_store(
        self,
        user_id: str,
        messages: List[Dict[str, str]],
        twin_brain_instance=None
    ) -> Optional[str]:
        """
        تلخيص آخر N رسالة وتحويلها إلى ذاكرة دائمة.
        """
        if not messages or len(messages) < 10:
            return None

        recent = messages[-self.max_messages:]
        conversation_text = "\n".join(
            f"{'مستخدم' if m.get('role') == 'user' else 'توأم'}: {m.get('content', '')}"
            for m in recent
        )

        prompt = f"""لخص هذه المحادثة بين المستخدم وتوأمه الذكي في 2-3 جمل بالعامية المصرية.
ركز على: المواضيع الرئيسية، المشاعر السائدة، أي قرارات أو أهداف ذُكرت.
المحادثة:
{conversation_text[:3000]}

الملخص:"""

        summary = None
        if twin_brain_instance and hasattr(twin_brain_instance, 'multi'):
            try:
                reply = await twin_brain_instance.multi.get_best_reply(prompt)
                if reply and len(reply) > 10:
                    summary = reply.strip()
            except Exception as e:
                logger.warning(f"Summarization failed: {e}")

        if not summary:
            # ملخص بسيط بدون LLM
            topics = set()
            for m in recent:
                if m.get('role') == 'user':
                    words = m.get('content', '').split()
                    topics.update(w for w in words if len(w) > 3)
            summary = f"محادثة تناولت مواضيع: {', '.join(list(topics)[:5])}"

        # تخزين في الذكريات
        try:
            from supabase import create_client
            import os
            db = create_client(
                os.getenv("SUPABASE_URL", ""),
                os.getenv("SUPABASE_SERVICE_KEY", "")
            )
            db.table("memories").insert({
                "user_id": user_id,
                "content": f"[ملخص] {summary}",
                "importance": 0.8,
                "emotion": "neutral",
                "memory_type": "episodic",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            logger.info(f"✅ Memory summarized for {user_id}")
        except Exception as e:
            logger.warning(f"Failed to store summary: {e}")

        # إعادة تعيين العداد
        await self.reset_counter(user_id)
        return summary


memory_summarizer = MemorySummarizer()
print("✅ Memory Summarizer v1.0 initialized")
