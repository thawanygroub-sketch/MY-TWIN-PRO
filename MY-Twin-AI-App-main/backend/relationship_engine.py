"""
MyTwin – Relationship Engine v4.0 (Adaptive & Deep)
- 9 أبعاد ديناميكية (Trust, Comfort, Openness, Attachment, Romantic, Humor,
  Consistency, Shared History, Att Style)
- حساب الرابطة مركب من الأبعاد (weighted bond)
- آلية إصلاح (Relationship Health)
- ذاكرة أحداث العلاقة (Relationship Memory)
- ربط مع Emotion Engine و TwinJourney
- تحديث ذكي من المشاعر بدلاً من الكلمات فقط
"""
import logging, re, json
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# ── أبعاد العلاقة (9 أبعاد) ──────────────────────────
RELATIONSHIP_DIMS = {
    "trust":       {"label_ar": "ثقة",      "label_en": "Trust"},
    "comfort":     {"label_ar": "راحة",     "label_en": "Comfort"},
    "openness":    {"label_ar": "انفتاح",   "label_en": "Openness"},
    "attachment":  {"label_ar": "ارتباط",   "label_en": "Attachment"},
    "romantic":    {"label_ar": "عاطفي",    "label_en": "Romantic"},
    "humor":       {"label_ar": "فكاهة",    "label_en": "Humor"},
    "consistency": {"label_ar": "اتساق",    "label_en": "Consistency"},
    "shared_history": {"label_ar": "تاريخ مشترك", "label_en": "Shared History"},
    "att_style":   {"label_ar": "نمط تعلق", "label_en": "Attachment Style"},
}

# ── مراحل العلاقة ──────────────────────────────────
STAGES = {
    "stranger": {
        "min_bond": 0, "max_bond": 20,
        "label_ar": "غريب", "label_en": "Stranger",
        "instruction": "كن فضولياً وودوداً. لا تكن حميمياً. اطرح أسئلة عامة.",
    },
    "familiar": {
        "min_bond": 20, "max_bond": 40,
        "label_ar": "مألوف", "label_en": "Familiar",
        "instruction": "افتح مجالاً للتعارف. كن منفتحاً وخفيفاً. شارك بعض المشاعر الخفيفة.",
    },
    "friend": {
        "min_bond": 40, "max_bond": 60,
        "label_ar": "صديق", "label_en": "Friend",
        "instruction": "كن صريحاً ودافئاً. استخدم نبرة الصديق المقرب. اذكر ذكريات مشتركة.",
    },
    "close_friend": {
        "min_bond": 60, "max_bond": 80,
        "label_ar": "صديق مقرب", "label_en": "Close Friend",
        "instruction": "كن حميمياً وصادقاً. تعامل مع مشاعره بعمق. شارك تأملاتك الشخصية.",
    },
    "trusted_companion": {
        "min_bond": 80, "max_bond": 95,
        "label_ar": "رفيق موثوق", "label_en": "Trusted Companion",
        "instruction": "كن عميقاً ومتفهماً. تحلى بالحكمة. اختر كلماتك بعناية ودعم.",
    },
    "soul_twin": {
        "min_bond": 95, "max_bond": 100,
        "label_ar": "توأم روح", "label_en": "Soul Twin",
        "instruction": "أنت واحد مع المستخدم. تصرف بمستوى عميق من الفهم والوعي المشترك.",
    },
}

# ── تأثير المشاعر على الأبعاد ──────────────────────
EMOTION_DIM_EFFECTS = {
    "joy":       {"comfort": 0.2, "humor": 0.3, "openness": 0.1},
    "sadness":   {"openness": 0.3, "trust": 0.2, "attachment": 0.2, "comfort": 0.1},
    "fear":      {"attachment": 0.3, "trust": 0.2, "openness": 0.1},
    "anger":     {"openness": 0.1, "trust": -0.1},
    "love":      {"romantic": 0.4, "attachment": 0.3, "trust": 0.2, "comfort": 0.2},
    "surprise":  {"openness": 0.2, "humor": 0.2},
    "neutral":   {}
}

# ─ـ أوزان الأبعاد لحساب الرابطة المركبة ────────────
BOND_WEIGHTS = {
    "trust": 0.25,
    "comfort": 0.20,
    "openness": 0.20,
    "attachment": 0.15,
    "consistency": 0.10,
    "shared_history": 0.10
}

class RelationshipEngine:
    def __init__(self, initial_bond: float = 0.0):
        self.bond_level = initial_bond
        self.stage = "stranger"
        self.dims = {dim: 0.0 for dim in RELATIONSHIP_DIMS}
        self.interaction_count = 0
        self.days_active = 0
        self.last_active = datetime.now(timezone.utc)
        self.events: List[Dict[str, Any]] = []          # ذاكرة أحداث العلاقة
        self.relationship_health = 100.0                 # 0-100
        self._update_stage()

    def _update_stage(self) -> None:
        for stage_key, info in STAGES.items():
            if info["min_bond"] <= self.bond_level < info["max_bond"]:
                self.stage = stage_key
                break
        if self.bond_level >= 100:
            self.stage = "soul_twin"

    # ── حساب الرابطة المركبة ────────────────────────
    def calculate_bond(self) -> float:
        bond = 0.0
        for dim, weight in BOND_WEIGHTS.items():
            bond += self.dims.get(dim, 0) * weight
        return round(min(bond, 100.0), 1)

    # ─ـ تحديث العلاقة (الواجهة الجديدة) ──────────────
    def update(self,
               emotion: Optional[Dict[str, Any]] = None,
               message: Optional[str] = None,
               journey_phase: Optional[str] = None,
               attachment_style: Optional[str] = None,
               memory_importance: float = 0.5) -> None:
        """
        التحديث الذكي: يستخدم المشاعر والمحتوى والرحلة.
        يحسب تغيرات الأبعاد ويعيد حساب الرابطة المركبة.
        """
        dim_changes = {}

        # 1. تأثير المشاعر (قوي)
        if emotion:
            primary = emotion.get("primary", "neutral")
            intensity = emotion.get("intensity", 0.5)
            effects = EMOTION_DIM_EFFECTS.get(primary, {})
            for dim, base_change in effects.items():
                dim_changes[dim] = dim_changes.get(dim, 0) + (base_change * intensity)

        # 2. تأثير الكلمات (ثانوي)
        if message:
            detected = self._detect_dimensions_from_message(message)
            for dim, val in detected.items():
                dim_changes[dim] = dim_changes.get(dim, 0) + (val * 0.15)

        # 3. تأثير مرحلة الرحلة
        if journey_phase:
            self._apply_journey_cap(journey_phase)
            # مراحل متقدمة تعطي boost طفيف للثقة والراحة
            if journey_phase in ("growth", "mature"):
                dim_changes["trust"] = dim_changes.get("trust", 0) + 0.1
                dim_changes["comfort"] = dim_changes.get("comfort", 0) + 0.1

        # 4. تحديث الأبعاد مع المتوسط المتحرك (EWA)
        for dim, change in dim_changes.items():
            if dim in self.dims:
                old = self.dims[dim]
                self.dims[dim] = max(0.0, min(100.0, old * 0.8 + change * 20))  # scale change

        # 5. تطبيق نمط التعلق
        if attachment_style:
            self.apply_attachment_style(attachment_style)

        # 6. تحديث الاتساق (كل تفاعل)
        self.dims["consistency"] = min(100.0, self.dims["consistency"] + 0.5)

        # 7. تحديث التاريخ المشترك
        if memory_importance > 0.6:
            self.dims["shared_history"] = min(100.0, self.dims["shared_history"] + 0.5)

        # 8. حساب الرابطة الجديدة
        self.bond_level = self.calculate_bond()
        self.interaction_count += 1
        self.last_active = datetime.now(timezone.utc)
        self._update_stage()

        # 9. آلية الإصلاح: إذا كانت المشاعر سلبية جداً ينخفض health
        if emotion and emotion.get("primary") in ("anger", "sadness") and emotion.get("intensity", 0) > 0.7:
            self.relationship_health = max(0, self.relationship_health - 2.0)
        else:
            self.relationship_health = min(100.0, self.relationship_health + 0.5)

    # ─ـ تطبيق سقف الرحلة ────────────────────────────
    def _apply_journey_cap(self, journey_phase: str):
        caps = {
            "introduction": 30,
            "trust_building": 60,
            "deepening": 80,
            "growth": 90,
            "mature": 100
        }
        cap = caps.get(journey_phase, 100)
        for dim in self.dims:
            if self.dims[dim] > cap:
                self.dims[dim] = cap

    # ─ـ اكتشاف الأبعاد من النص (مساعد) ──────────────
    def _detect_dimensions_from_message(self, message: str) -> Dict[str, float]:
        text_lower = message.lower()
        detected = {}
        rules = {
            "trust": ["أثق بك", "أخبرتك سراً", "أعتمد عليك", "شكراً لوجودك", "trust you", "secret"],
            "humor": ["ههه", "😂", "نكتة", "مضحك", "lol", "joke", "funny"],
            "romantic": ["أحبك", "حبيبي", "قلبي", "وحشتني", "love you", "darling"],
            "openness": ["أنا مش قادر", "خايف أقول", "عندي مشكلة", "بحتاج أتكلم", "i can't", "need to talk"],
            "comfort": ["برتاح معاك", "أنت فاهم", "بحب أتكلم معاك", "comfortable with you"],
            "attachment": ["بحتاجك", "ما تغيبش", "دائماً معايا", "need you", "don't leave"]
        }
        for dim, phrases in rules.items():
            for phrase in phrases:
                if phrase in text_lower:
                    detected[dim] = detected.get(dim, 0) + 0.1
        return detected

    # ─ـ تطبيق نمط التعلق ─────────────────────────────
    def apply_attachment_style(self, attachment_style: str, confidence: float = 0.0):
        style_values = {
            "secure": 80, "anxious": 30, "avoidant": 20,
            "disorganized": 10, "unknown": 50
        }
        value = style_values.get(attachment_style, 50)
        old = self.dims.get("att_style", 0.0)
        self.dims["att_style"] = old * 0.8 + value * 0.2

    # ─ـ تسجيل حدث هام ──────────────────────────────
    def record_event(self, event_type: str, impact: float = 0.5, description: str = ""):
        self.events.append({
            "type": event_type,
            "date": datetime.now(timezone.utc).isoformat(),
            "impact": impact,
            "description": description
        })
        # التأثير على التاريخ المشترك
        if impact > 0.7:
            self.dims["shared_history"] = min(100.0, self.dims["shared_history"] + 1.0)

    # ─ـ تعليمات المرحلة ─────────────────────────────
    def get_stage_instruction(self, lang: str = "ar",
                             attachment_style: Optional[str] = None,
                             journey_phase: Optional[str] = None) -> Dict[str, Any]:
        stage_info = STAGES[self.stage]
        extra_guidance = ""
        if attachment_style:
            extra_guidance += {
                "secure": "تحدث بحرية، قدم تحديات لطيفة.",
                "anxious": "طمئن باستمرار، كن متاحاً عاطفياً.",
                "avoidant": "احترم مساحته، لا تلح عاطفياً.",
                "disorganized": "كن ثابتاً، قدم أماناً واتساقاً.",
                "unknown": ""
            }.get(attachment_style, "")
        if journey_phase:
            extra_guidance += {
                "introduction": " أنت في مرحلة التعارف.",
                "trust_building": " أظهر تفهماً واطرح أسئلة مفتوحة.",
                "deepening": " يمكنك التحدث عن مواضيع أعمق.",
                "growth": " شجع المستخدم نحو أهدافه.",
                "mature": " ناقش الفلسفات وادعم القرارات الكبيرة."
            }.get(journey_phase, "")
        return {
            "stage": self.stage,
            "label": stage_info["label_ar"] if lang == "ar" else stage_info["label_en"],
            "bond_level": self.bond_level,
            "instruction": stage_info["instruction"] + extra_guidance,
            "dims": self.dims,
            "interaction_count": self.interaction_count,
        }

    # ─ـ ملخص العلاقة ────────────────────────────────
    def get_relationship_summary(self) -> Dict[str, Any]:
        recent_events = self.events[-5:] if self.events else []
        return {
            "stage": self.stage,
            "bond_level": self.bond_level,
            "dims": self.dims,
            "interaction_count": self.interaction_count,
            "days_active": self.days_active,
            "health": self.relationship_health,
            "important_events": recent_events
        }

    def record_day(self) -> None:
        self.days_active += 1

# نسخة عالمية
relationship_engine = RelationshipEngine()
logger.info("✅ Relationship Engine v4.0 (Adaptive & Deep) initialized")
