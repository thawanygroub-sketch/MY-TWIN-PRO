"""Importance Engine v1 — أهمية الذاكرة دستوريًا (الفصول 7/9/10).
≥85 تحوّيلية لا تموت | 65-84 مهمة تُحفظ طويلًا | <65 عادية تبقى عاملة فقط."""

TRANSFORMATIVE = ["أول مرة", "نجحت", "حققت", "تخرجت", "وظيفة جديدة", "خطوبة",
    "زواج", "ولادة", "انفصلنا", "طلق", "مات", "فقدت", "خسارة", "مرض", "شفيت",
    "first time", "i did it", "graduated", "engaged", "married", "lost"]
SIGNIFICANT = ["مشروع", "امتحان", "مقابلة", "أمي", "أبي", "زوجتي", "زوجي",
    "صديقي المقرب", "حلمي", "هدفي", "عائلتي", "my project", "my exam", "my family"]
EMOTION_WEIGHT = {"joy": 10, "love": 12, "sadness": 12, "fear": 12,
                  "anger": 10, "grief": 14}

def compute_importance(message: str, reply: str, emotion: str = "neutral",
                       intensity: float = 0.5) -> int:
    text = f"{message or ''} {reply or ''}"
    score = 40
    score += EMOTION_WEIGHT.get(emotion, 0)
    if any(k in text for k in TRANSFORMATIVE):
        score = max(score, 85)
    elif any(k in text for k in SIGNIFICANT):
        score = max(score, 68)
    score += int((intensity or 0.5) * 8)
    return max(5, min(100, score))
