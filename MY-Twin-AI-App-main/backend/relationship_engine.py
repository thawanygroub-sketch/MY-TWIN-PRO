import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

RELATIONSHIP_DIMS = {
    "trust": {"label_ar": "ثقة", "label_en": "Trust"},
    "comfort": {"label_ar": "راحة", "label_en": "Comfort"},
    "openness": {"label_ar": "انفتاح", "label_en": "Openness"},
    "attachment": {"label_ar": "ارتباط", "label_en": "Attachment"},
    "romantic": {"label_ar": "عاطفي", "label_en": "Romantic"},
    "humor": {"label_ar": "فكاهة", "label_en": "Humor"},
    "consistency": {"label_ar": "اتساق", "label_en": "Consistency"},
    "shared_history": {"label_ar": "تاريخ مشترك", "label_en": "Shared History"},
    "att_style": {"label_ar": "نمط تعلق", "label_en": "Attachment Style"},
}

STAGES = {
    "stranger": {"min_bond": 0, "max_bond": 20, "label_ar": "غريب", "label_en": "Stranger", "instruction": "كن فضولياً وودوداً."},
    "familiar": {"min_bond": 20, "max_bond": 40, "label_ar": "مألوف", "label_en": "Familiar", "instruction": "افتح مجالاً للتعارف."},
    "friend": {"min_bond": 40, "max_bond": 60, "label_ar": "صديق", "label_en": "Friend", "instruction": "كن صريحاً ودافئاً."},
    "close_friend": {"min_bond": 60, "max_bond": 80, "label_ar": "صديق مقرب", "label_en": "Close Friend", "instruction": "كن حميمياً وصادقاً."},
    "trusted_companion": {"min_bond": 80, "max_bond": 95, "label_ar": "رفيق موثوق", "label_en": "Trusted Companion", "instruction": "كن عميقاً ومتفهماً."},
    "soul_twin": {"min_bond": 95, "max_bond": 100, "label_ar": "توأم روح", "label_en": "Soul Twin", "instruction": "تصرف بمستوى عميق من الفهم."},
}

EMOTION_DIM_EFFECTS = {
    "joy": {"comfort": 0.2, "humor": 0.3, "openness": 0.1},
    "sadness": {"openness": 0.3, "trust": 0.2, "attachment": 0.2, "comfort": 0.1},
    "fear": {"attachment": 0.3, "trust": 0.2, "openness": 0.1},
    "anger": {"openness": 0.1, "trust": -0.1},
    "love": {"romantic": 0.4, "attachment": 0.3, "trust": 0.2, "comfort": 0.2},
    "surprise": {"openness": 0.2, "humor": 0.2},
    "neutral": {}
}

BOND_WEIGHTS = {"trust": 0.25, "comfort": 0.20, "openness": 0.20, "attachment": 0.15, "consistency": 0.10, "shared_history": 0.10}

class RelationshipEngine:
    def __init__(self):
        self.user_states: Dict[str, Dict[str, Any]] = {}

    def _get_state(self, user_id: str) -> Dict[str, Any]:
        if user_id not in self.user_states:
            self.user_states[user_id] = {
                "bond_level": 0.0, "stage": "stranger", "dims": {d: 0.0 for d in RELATIONSHIP_DIMS},
                "interaction_count": 0, "last_active": datetime.now(timezone.utc), "events": [],
                "relationship_health": 100.0,
            }
        return self.user_states[user_id]

    @property
    def bond_level(self):
        return self._get_state("default")["bond_level"]
    @property
    def dims(self):
        return self._get_state("default")["dims"]

    def calculate_bond(self, user_id="default"):
        state = self._get_state(user_id)
        return round(sum(state["dims"].get(d,0)*w for d,w in BOND_WEIGHTS.items()), 1)

    def get_relationship_summary(self, user_id="default"):
        state = self._get_state(user_id)
        return {"stage": state["stage"], "bond_level": state["bond_level"], "dims": state["dims"], "health": state["relationship_health"], "interaction_count": state["interaction_count"]}

    def update(self, emotion=None, message=None, journey_phase=None, attachment_style=None, memory_importance=0.5, user_id="default"):
        state = self._get_state(user_id)
        dim_changes = {}
        if emotion:
            primary = emotion.get("primary", "neutral")
            intensity = emotion.get("intensity", 0.5)
            for dim, change in EMOTION_DIM_EFFECTS.get(primary, {}).items():
                dim_changes[dim] = dim_changes.get(dim, 0) + (change * intensity)
        if message:
            detected = self._detect_dimensions_from_message(message)
            for dim, val in detected.items():
                dim_changes[dim] = dim_changes.get(dim, 0) + (val * 0.15)
        if journey_phase:
            caps = {"introduction":30,"trust_building":60,"deepening":80,"growth":90,"mature":100}
            cap = caps.get(journey_phase, 100)
            for dim in state["dims"]:
                if state["dims"][dim] > cap: state["dims"][dim] = cap
            if journey_phase in ("growth","mature"):
                dim_changes["trust"] = dim_changes.get("trust",0) + 0.1
                dim_changes["comfort"] = dim_changes.get("comfort",0) + 0.1
        for dim, change in dim_changes.items():
            if dim in state["dims"]:
                old = state["dims"][dim]
                state["dims"][dim] = max(0.0, min(100.0, old * 0.8 + change * 20))
        if attachment_style:
            style_values = {"secure":80,"anxious":30,"avoidant":20,"disorganized":10,"unknown":50}
            old = state["dims"].get("att_style", 0.0)
            state["dims"]["att_style"] = old * 0.8 + style_values.get(attachment_style, 50) * 0.2
        state["dims"]["consistency"] = min(100.0, state["dims"]["consistency"] + 0.5)
        if memory_importance > 0.6:
            state["dims"]["shared_history"] = min(100.0, state["dims"]["shared_history"] + 0.5)
        state["bond_level"] = self.calculate_bond(user_id)
        state["interaction_count"] += 1
        state["last_active"] = datetime.now(timezone.utc)
        for stage_key, info in STAGES.items():
            if info["min_bond"] <= state["bond_level"] < info["max_bond"]:
                state["stage"] = stage_key; break
        if state["bond_level"] >= 100: state["stage"] = "soul_twin"
        if emotion and emotion.get("primary") in ("anger","sadness") and emotion.get("intensity",0) > 0.7:
            state["relationship_health"] = max(0, state["relationship_health"] - 2.0)
        else:
            state["relationship_health"] = min(100.0, state["relationship_health"] + 0.5)

    def _detect_dimensions_from_message(self, message: str) -> Dict[str, float]:
        text = message.lower()
        detected = {}
        rules = {
            "trust": ["أثق بك","أخبرتك سراً","شكراً لوجودك","trust you"],
            "humor": ["ههه","😂","نكتة","مضحك","lol","funny"],
            "romantic": ["أحبك","حبيبي","قلبي","وحشتني","love you"],
            "openness": ["أنا مش قادر","خايف أقول","عندي مشكلة","i can't"],
            "comfort": ["برتاح معاك","أنت فاهم","comfortable with you"],
            "attachment": ["بحتاجك","ما تغيبش","need you","don't leave"]
        }
        for dim, phrases in rules.items():
            for phrase in phrases:
                if phrase in text: detected[dim] = detected.get(dim, 0) + 0.1
        return detected

    def get_stage_instruction(self, lang="ar", attachment_style=None, journey_phase=None, user_id="default"):
        state = self._get_state(user_id)
        stage_info = STAGES[state["stage"]]
        return {"stage": state["stage"], "label": stage_info["label_ar"] if lang=="ar" else stage_info["label_en"], "bond_level": state["bond_level"], "instruction": stage_info["instruction"], "dims": state["dims"]}

relationship_engine = RelationshipEngine()
