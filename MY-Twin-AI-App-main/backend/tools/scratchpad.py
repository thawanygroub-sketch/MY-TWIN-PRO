"""
MyTwin – Scratchpad v1.0 (ReAct: Thought → Action → Observation)
- يسجل كل خطوة تفكير وإجراء وملاحظة
- يُرسل للـ LLM في كل دورة لاتخاذ قرار مستنير
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone

class Scratchpad:
    def __init__(self):
        self.entries: List[Dict] = []

    def add_thought(self, thought: str):
        self.entries.append({"type": "thought", "content": thought, "time": datetime.now(timezone.utc).isoformat()})

    def add_action(self, tool_name: str):
        self.entries.append({"type": "action", "content": tool_name, "time": datetime.now(timezone.utc).isoformat()})

    def add_observation(self, result: str):
        self.entries.append({"type": "observation", "content": result[:300], "time": datetime.now(timezone.utc).isoformat()})

    def get_context(self) -> str:
        """بناء نص السياق التراكمي للـ LLM"""
        lines = []
        for entry in self.entries:
            if entry["type"] == "thought":
                lines.append(f"💭 فكرت: {entry['content']}")
            elif entry["type"] == "action":
                lines.append(f"🔧 استخدمت: {entry['content']}")
            elif entry["type"] == "observation":
                lines.append(f"👀 لاحظت: {entry['content']}")
        return "\n".join(lines)

    def get_last_observation(self) -> Optional[str]:
        for entry in reversed(self.entries):
            if entry["type"] == "observation":
                return entry["content"]
        return None

    def clear(self):
        self.entries = []

    def count_actions(self) -> int:
        return sum(1 for e in self.entries if e["type"] == "action")

    def get_used_tools(self) -> set:
        return {e["content"] for e in self.entries if e["type"] == "action"}


scratchpad = Scratchpad()
