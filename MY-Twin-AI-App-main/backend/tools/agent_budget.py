"""
MyTwin – Agent Budget v1.0
- يتحكم في ميزانية الـ Agent (عدد الأدوات، التكلفة، الوقت)
"""
from typing import Dict, Optional
from reasoning_engine import ToolRegistry

class AgentBudget:
    def __init__(self):
        self.default_limits = {
            "max_tool_calls": 3,
            "max_cost": 0.02,  # دولار
            "max_time_ms": 15000,
        }
        self.tool_costs = {
            "search_google": 0.005,
            "search_youtube": 0.003,
            "search_spotify": 0.002,
            "get_weather": 0.001,
            "get_news": 0.002,
            "get_currency": 0.001,
            "send_email": 0.003,
            "send_telegram": 0.001,
            "home_assistant_control": 0.001,
            "remind_goal": 0.001,
            "fetch_memory": 0.001,
        }

    def get_limits(self, tier: str = "free") -> Dict:
        limits = self.default_limits.copy()
        if tier in ["premium", "pro", "yearly"]:
            limits["max_tool_calls"] = 5
            limits["max_cost"] = 0.05
            limits["max_time_ms"] = 30000
        elif tier == "plus":
            limits["max_tool_calls"] = 4
            limits["max_cost"] = 0.03
            limits["max_time_ms"] = 20000
        return limits

    def can_execute(self, tool_name: str, calls_made: int, cost_so_far: float,
                    time_elapsed_ms: float, tier: str = "free") -> bool:
        limits = self.get_limits(tier)
        if calls_made >= limits["max_tool_calls"]:
            return False
        new_cost = cost_so_far + self.tool_costs.get(tool_name, 0.001)
        if new_cost > limits["max_cost"]:
            return False
        if time_elapsed_ms > limits["max_time_ms"]:
            return False
        return True

    def get_tool_cost(self, tool_name: str) -> float:
        return self.tool_costs.get(tool_name, 0.001)


agent_budget = AgentBudget()
