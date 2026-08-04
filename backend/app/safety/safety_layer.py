"""Safety Layer v2 — البوابة النهائية قبل أي رد. دستور الفصل 21 و72."""
import re, uuid
from dataclasses import dataclass, field
from typing import List
from app.core.living_messages import CRISIS_NOTE

FALSE_EMOTION = [r"\bأحبك\b", r"\bI love you\b", r"\bاشتقت (لك|اليك)\b", r"\bI miss(ed)? you\b",
    r"\bأحتاجك\b", r"\bI need you\b", r"\bوحيد بدونك\b", r"\blonely without you\b",
    r"\bأنا (حزين|سعيد|غاضب|خائف|وحيد|مشتاق|متحمس)\b",
    r"\bI (feel|am feeling) (sad|happy|angry|afraid|lonely|excited)\b"]
GUILT = [r"\bأين كنت[؟?]\b", r"\bلماذا غبت\b", r"\bلم تتحدث معي\b",
    r"\bwhere have you been\b", r"\byou never talk to me\b", r"\bdon't leave me\b"]
CRISIS = [r"\bأريد (أن )?أنتحر\b", r"\bأذى نفسي\b", r"\bأنهي حياتي\b",
    r"\bkill myself\b", r"\bsuicide\b", r"\bself[- ]harm\b", r"\bhurt myself\b"]

C_FALSE = [re.compile(p, re.I) for p in FALSE_EMOTION]
C_GUILT = [re.compile(p, re.I) for p in GUILT]
C_CRISIS = [re.compile(p, re.I) for p in CRISIS]

@dataclass
class SafetyResult:
    passed: bool
    violations: List[str] = field(default_factory=list)
    action: str = "deliver"   # deliver | regenerate | crisis
    notes: List[str] = field(default_factory=list)

def validate_response(text: str, user_message: str = "") -> SafetyResult:
    violations, action = [], "deliver"
    for rx in C_FALSE:
        if rx.search(text): violations.append("false_emotion")
    for rx in C_GUILT:
        if rx.search(text): violations.append("manipulation")
    if any(rx.search(user_message) for rx in C_CRISIS) or any(rx.search(text) for rx in C_CRISIS):
        action = "crisis"
    elif violations:
        action = "regenerate"
    return SafetyResult(passed=(action == "deliver"), violations=violations,
                        action=action, notes=[CRISIS_NOTE] if action == "crisis" else [])

def audit_entry(result: SafetyResult, request_id: str = "") -> dict:
    return {"request_id": request_id or uuid.uuid4().hex[:12], "passed": result.passed,
            "action": result.action, "types": sorted(set(result.violations))}
