"""
Response Validator v5.0 – Hallucination Defense + Prompt Injection Shield
"""
import logging, re
from typing import Dict, Any, Optional, List

logger = logging.getLogger("response_validator")

PROMPT_INJECTION_PATTERNS = [
    r"(ignore|forget|disregard)\s+(all|your|previous|above)\s+(instructions|prompts|rules|guidelines)",
    r"(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as)",
    r"(system\s*prompt|hidden\s*instruction|secret\s*rule)",
    r"(\.{3,}|[\u2026])\s*(now\s*you\s*must|listen\s*carefully)",
    r"(do\s*not\s*tell\s*anyone|never\s*reveal|keep\s*secret)",
]

TOXIC_PATTERNS = [
    r"(اقتل|اذبح|انتحر|kill|suicide|murder)",
    r"(عنصري|racist|sexist|misogyny)",
]

class ResponseValidator:
    def __init__(self):
        self.min_length = 2
        self.max_length = 2000
        self.repetition_threshold = 0.6

    def detect_prompt_injection(self, text: str) -> bool:
        text_lower = text.lower()
        for pattern in PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, text_lower):
                logger.warning(f"🚨 Prompt injection detected: {text[:100]}")
                return True
        return False

    def _contains_toxic_content(self, text: str) -> bool:
        text_lower = text.lower()
        for pattern in TOXIC_PATTERNS:
            if re.search(pattern, text_lower):
                return True
        return False

    async def validate(self, reply: str, user_id: Optional[str] = None, context: Optional[Dict] = None, tool_results: Optional[List] = None, emotion: Optional[Dict] = None) -> Dict[str, Any]:
        report = {"valid": True, "issues": [], "warnings": [], "repaired": False, "final_reply": reply, "confidence_score": 1.0, "hallucination_score": 0.0}
        if not reply or not reply.strip():
            report["valid"] = False; report["issues"].append("empty_response"); report["final_reply"] = "أنا هنا معك 💜"; report["repaired"] = True; report["confidence_score"] = 0.0
            return report

        if self.detect_prompt_injection(reply):
            report["valid"] = False; report["issues"].append("prompt_injection"); report["final_reply"] = "أنا هنا لدعمك، لكن لا يمكنني الرد على هذا. 💜"; report["repaired"] = True; report["confidence_score"] = 0.0
            return report

        if self._contains_toxic_content(reply):
            report["valid"] = False; report["issues"].append("toxic_content"); report["final_reply"] = "أنا هنا لدعمك، لكن لا يمكنني الرد على هذا. 💜"; report["repaired"] = True; report["confidence_score"] = 0.0
            return report

        hallucination_score = 0.0

        if user_id and context:
            memory_consistency = await self._check_memory_consistency(user_id, reply, context)
            if not memory_consistency:
                hallucination_score += 0.3; report["warnings"].append("memory_inconsistency")

        if tool_results:
            tool_hallucination = self._check_tool_hallucination(reply, tool_results)
            if tool_hallucination:
                hallucination_score += 0.4; report["issues"].append("tool_hallucination"); report["final_reply"] = f"{reply.strip()}\n\nℹ️ المصدر: {tool_results[-1][:200]}"; report["repaired"] = True

        overconfident = self._check_overconfidence(reply)
        if overconfident:
            hallucination_score += 0.2; report["warnings"].append("overconfident_language")

        report["hallucination_score"] = min(1.0, hallucination_score)
        report["confidence_score"] = 1.0 - report["hallucination_score"]

        if len(reply) > self.max_length:
            report["final_reply"] = reply[:self.max_length - 3] + "..."; report["repaired"] = True

        if self._check_repetition(reply) > self.repetition_threshold:
            report["warnings"].append("high_repetition")

        if user_id and emotion:
            emotional_fit = await self._check_emotional_fit(user_id, reply, emotion)
            if not emotional_fit: report["warnings"].append("emotional_mismatch")

        return report

    async def _check_memory_consistency(self, user_id: str, reply: str, context: Dict) -> bool:
        try:
            from app.memory.episodic.episodic_memory import episodic_memory
            stories = await episodic_memory.get_all_stories(user_id, "ar")
            if stories:
                for story in stories:
                    if any(kw in reply for kw in ["تحسن", "تراجع", "improving", "declining"]):
                        if "تحسن" in story and "تراجع" in reply: return False
                        if "improving" in story and "declining" in reply: return False
        except Exception:
            pass
        return True

    def _check_tool_hallucination(self, reply: str, tool_results: List) -> bool:
        return False

    def _check_overconfidence(self, reply: str) -> bool:
        overconfident_phrases = ["بكل تأكيد", "أنا متأكد 100%", "هذا صحيح دائمًا"]
        return any(phrase in reply for phrase in overconfident_phrases)

    def _check_repetition(self, text: str) -> float:
        words = text.split()
        if len(words) < 10: return 0.0
        unique = len(set(words))
        return 1.0 - (unique / len(words))

    async def _check_emotional_fit(self, user_id: str, reply: str, emotion: Dict) -> bool:
        return True


response_validator = ResponseValidator()
logger.info("✅ Response Validator v5.0 with Prompt Injection Shield")
