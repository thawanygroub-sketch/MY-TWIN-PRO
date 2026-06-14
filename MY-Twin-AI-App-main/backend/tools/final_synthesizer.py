"""
MyTwin – Final Synthesizer v1.0
- يدمج نتائج الأدوات + الذاكرة + السياق في رد نهائي واحد
"""
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("final_synthesizer")

class FinalSynthesizer:
    async def synthesize(
        self,
        message: str,
        tool_results: List[Dict[str, Any]],
        context_summary: str,
        twin_brain_instance=None
    ) -> Optional[str]:
        """
        توليف الرد النهائي باستخدام LLM مباشر (بدون استدعاء twin_brain كاملاً).
        """
        if not twin_brain_instance or not hasattr(twin_brain_instance, 'multi'):
            return None

        tools_context = "\n".join([
            f"- {r.get('tool', 'أداة')}: {r.get('result', '')[:300]}"
            for r in tool_results
        ])

        prompt = f"""أنت MyTwin، رفيق ذكي. أجب على رسالة المستخدم بناءً على نتائج الأدوات والسياق.

رسالة المستخدم: {message}

نتائج الأدوات:
{tools_context}

السياق الإضافي:
{context_summary[:1000]}

اكتب رداً طبيعياً ودافئاً بالعامية المصرية (2-4 جمل):
الرد:"""

        try:
            reply = await twin_brain_instance.multi.get_best_reply(prompt)
            if reply and len(reply) > 5:
                return reply.strip()
        except Exception as e:
            logger.warning(f"Final synthesis failed: {e}")

        return None


final_synthesizer = FinalSynthesizer()
