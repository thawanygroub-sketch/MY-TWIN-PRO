"""Response Envelope v2 — يضيف expression_intent + life_observation للجسد والصوت."""
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
        "twin_emotional_state": {"current_emotion": emotion, "intensity": intensity, "confidence": 0.8},
        "twin_state_update": {
            "relationship": {"bond_level": bond, "trust": min(100, 50 + bond / 2)},
            "personality_dna": brain.get("personality_dna", {}),
        },
        "expression_intent": brain.get("expression_intent", {"breath": "normal", "smile": 0.0, "pause": 0.0, "concern": 0.0}),
        "life_observation": brain.get("life_observation"),
        "request_id": request_id,
    })
    return env
