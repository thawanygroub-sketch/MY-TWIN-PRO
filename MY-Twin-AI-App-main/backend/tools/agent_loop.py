import logging, time
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger("agent_loop")

class AgentLoop:
    def __init__(self, max_iterations: int = 5):
        self.max_iterations = max_iterations

    async def execute(
        self,
        plan: Dict[str, Any],
        user_id: str,
        message: str,
        emotion: Dict[str, Any],
        twin_brain_instance=None,
        context_summary: str = "",
        lang: str = "ar"
    ) -> Dict[str, Any]:
        # استيراد موضعي لتجنب مشاكل الاعتماديات الدائرية
        from .tool_executor import tool_executor
        from tool_registry import ToolRegistry
        from .agent_budget import agent_budget
        from .final_synthesizer import final_synthesizer

        # إعادة تهيئة scratchpad يدوياً بدلاً من استيراده كوحدة منفصلة
        scratchpad = {"entries": [], "used_tools": set()}

        def add_thought(thought: str):
            scratchpad["entries"].append({"type": "thought", "content": thought})

        def add_action(tool_name: str):
            scratchpad["entries"].append({"type": "action", "content": tool_name})
            scratchpad["used_tools"].add(tool_name)

        def add_observation(result: str):
            scratchpad["entries"].append({"type": "observation", "content": result[:300]})

        def get_context() -> str:
            lines = []
            for entry in scratchpad["entries"]:
                if entry["type"] == "thought": lines.append(f"💭 فكرت: {entry['content']}")
                elif entry["type"] == "action": lines.append(f"🔧 استخدمت: {entry['content']}")
                elif entry["type"] == "observation": lines.append(f"👀 لاحظت: {entry['content']}")
            return "\n".join(lines)

        tool_results = []
        calls_made = 0
        cost_so_far = 0.0
        start_time = time.time()
        tier = "free"
        iteration = 0

        while iteration < self.max_iterations:
            iteration += 1
            time_elapsed = (time.time() - start_time) * 1000

            next_tool = await self._decide_next_action(
                twin_brain_instance, message, scratchpad, lang
            )
            if not next_tool or next_tool.lower() == 'done':
                add_thought("اكتملت جميع الإجراءات اللازمة")
                break

            if next_tool in scratchpad["used_tools"]:
                add_thought(f"الأداة {next_tool} استُخدمت بالفعل، أبحث عن بديل")
                continue

            if not agent_budget.can_execute(next_tool, calls_made, cost_so_far, time_elapsed, tier):
                add_thought("تجاوزت الميزانية المسموحة، أتوقف")
                break

            add_action(next_tool)
            calls_made += 1
            cost_so_far += agent_budget.get_tool_cost(next_tool)

            result = await tool_executor.execute(
                tool_name=next_tool, message=message,
                user_id=user_id, tier=tier
            )

            if result:
                add_observation(result)
                tool_results.append({"tool": next_tool, "result": result, "iteration": iteration})
            else:
                add_observation(f"الأداة {next_tool} لم تُرجع نتيجة")

        final_reply = None
        if tool_results and twin_brain_instance:
            synthesized = await final_synthesizer.synthesize(
                message=message, tool_results=tool_results,
                context_summary=context_summary, twin_brain_instance=twin_brain_instance
            )
            if synthesized:
                final_reply = synthesized

        if not final_reply and tool_results:
            final_reply = "\n\n".join([t["result"] for t in tool_results])
        if not final_reply:
            final_reply = "عذراً، لم أتمكن من معالجة طلبك."

        return {"reply": final_reply, "provider": "agent_loop", "tool_results": tool_results}

    async def _decide_next_action(self, twin_brain_instance, message, scratchpad, lang):
        if not twin_brain_instance or not hasattr(twin_brain_instance, 'multi'):
            return None
        from tool_registry import ToolRegistry
        available_tools = [t for t in ToolRegistry.list_tools() if t not in scratchpad["used_tools"]]
        if not available_tools:
            return None
        tools_list = ", ".join(available_tools)
        context = "\n".join(
            f"{'💭' if e['type']=='thought' else '🔧' if e['type']=='action' else '👀'}: {e['content'][:200]}"
            for e in scratchpad["entries"]
        )
        prompt = f"""السجل: {context}
الأدوات المتاحة: {tools_list}
الرسالة: "{message}"
أعد اسم أداة واحدة أو 'done':"""
        try:
            reply = await twin_brain_instance.multi.get_best_reply(prompt)
            if reply:
                reply = reply.strip().lower()
                for tool in available_tools:
                    if tool in reply:
                        return tool
                if reply == 'done':
                    return None
        except Exception as e:
            logger.warning(f"Decision failed: {e}")
        return None


agent_loop = AgentLoop()
print("✅ Agent Loop v4.1 (self-contained scratchpad) initialized")
