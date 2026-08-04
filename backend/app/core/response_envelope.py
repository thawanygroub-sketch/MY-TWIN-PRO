"""Response Envelope — العقد الموحد بين العقل (Backend) والجسد (StateBus).
يضمن أن كل استجابة تحمل ما يقرؤه الجسد: presence_state / twin_emotional_state /
twin_state_update. لا NaN، لا حقول مفقودة، لا كسر حضور."""
from typing import Dict, Any

def build_envelope(brain: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    emotion = brain.get("emotion", "neutral") or "neutral"
    intensity = float(brain.get("intensity", 0.5) or 0.5)
    bond = int(brain.get("bond_level", 0) or 0)
    surfaced = brain.get("memory_surfaced")
    level = 2 + intensity * 4 + (2 if surfaced else 0) + (1 if bond > 60 else 0)
    level = max(0, min(9, round(level)))
    env = dict(brain)
    env.update({
        "presence_state": {"emotion": emotion, "intensity": intensity, "level": level},
        "twin_emotional_state": {"current_emotion": emotion, "intensity": intensity,
                                 "confidence": 0.8},
        "twin_state_update": {
            "relationship": {"bond_level": bond, "trust": min(100, 50 + bond / 2)},
            "personality_dna": brain.get("personality_dna", {}),
        },
        "request_id": request_id,
    })
    return env
