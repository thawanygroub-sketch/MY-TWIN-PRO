import os, logging, asyncio, warnings
from typing import Optional, AsyncGenerator

# تجاهل تحذير إهمال مكتبة Gemini
warnings.filterwarnings("ignore", message="All support for the `google.generativeai` package has ended")

import google.generativeai as genai
from openai import OpenAI

logger = logging.getLogger("multi_ai")

class AIUnavailable(Exception):
    pass

class MultiAIClient:
    def __init__(self):
        # ── Gemini 1.5 Flash (محلي – احتياطي نهائي) ──
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            try:
                genai.configure(api_key=gemini_key)
                self.gemini_flash = genai.GenerativeModel("gemini-1.5-flash")
            except Exception as e:
                logger.error(f"Gemini init failed: {e}")
                self.gemini_flash = None
        else:
            self.gemini_flash = None

        # ── Groq ────────────────────────────────────
        groq_key = os.getenv("GROQ_API_KEY")
        self.groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=groq_key) if groq_key else None

        # ── OpenRouter ──────────────────────────────
        or_key = os.getenv("OPENROUTER_API_KEY")
        self.or_client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=or_key) if or_key else None

    # ── دوال الاتصال ──────────────────────────────
    def _groq(self, model: str, prompt: str) -> Optional[str]:
        if not self.groq_client: return None
        try:
            resp = self.groq_client.chat.completions.create(
                model=model, messages=[{"role":"user","content":prompt}],
                temperature=0.7, max_tokens=150
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"Groq [{model}]: {e}")
            return None

    def _or(self, model: str, prompt: str) -> Optional[str]:
        if not self.or_client: return None
        try:
            resp = self.or_client.chat.completions.create(
                model=model, messages=[{"role":"user","content":prompt}],
                temperature=0.7, max_tokens=150
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenRouter [{model}]: {e}")
            return None

    # ── Groq (Coaching, Dream, Music/Video) ────────
    def groq_chat(self, p): return self._groq("llama-3.3-70b-versatile", p)

    # ── OpenRouter Models ──────────────────────────
    def llama4_chat(self, p):       return self._or("meta-llama/llama-4-maverick", p)
    def deepseek_chat(self, p):     return self._or("deepseek/deepseek-v4-flash", p)
    def kimi_chat(self, p):         return self._or("moonshotai/kimi-k2.6:free", p)
    def laguna_chat(self, p):       return self._or("poolside/laguna-m.1:free", p)
    def mistral_chat(self, p):      return self._or("mistralai/mistral-small-3.1-24b-instruct", p)
    def cohere_chat(self, p):       return self._or("cohere/command-r7b-12-2024", p)

    # ── Gemini (احتياطي نهائي) ────────────────────
    def gemini_chat(self, p: str) -> str:
        if not self.gemini_flash:
            return "أنا هنا معاك 💜"
        try:
            resp = self.gemini_flash.generate_content(p)
            return resp.text.strip() if resp.text else "أنا هنا معاك 💜"
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return "أنا هنا معاك 💜"

    # ── توزيع المهام الذكي ────────────────────────
    async def get_best_reply(self, prompt: str, task: str = "general") -> str:
        chains = {
            "general":        [self.llama4_chat, self.kimi_chat, self.groq_chat, self.gemini_chat],
            "emotional":      [self.llama4_chat, self.kimi_chat, self.mistral_chat, self.gemini_chat],
            "coding":         [self.deepseek_chat, self.laguna_chat, self.mistral_chat, self.groq_chat, self.gemini_chat],
            "deep_reasoning": [self.deepseek_chat, self.kimi_chat, self.mistral_chat, self.gemini_chat],
            "multilingual":   [self.kimi_chat, self.llama4_chat, self.cohere_chat, self.gemini_chat],
            "planning":       [self.cohere_chat, self.mistral_chat, self.llama4_chat, self.gemini_chat],
            "coaching":       [self.groq_chat, self.llama4_chat, self.kimi_chat, self.gemini_chat],
            "dream":          [self.groq_chat, self.llama4_chat, self.kimi_chat, self.gemini_chat],
            "music":          [self.groq_chat, self.llama4_chat, self.kimi_chat, self.gemini_chat],
            "video":          [self.groq_chat, self.llama4_chat, self.kimi_chat, self.gemini_chat],
            "search":         [self.laguna_chat, self.deepseek_chat, self.cohere_chat, self.gemini_chat],
            "agent":          [self.mistral_chat, self.laguna_chat, self.deepseek_chat, self.gemini_chat],
        }
        loop = asyncio.get_running_loop()
        for fn in chains.get(task, chains["general"]):
            try:
                result = await loop.run_in_executor(None, fn, prompt)
                if result and len(result.strip()) >= 1:
                    logger.info(f"✅ [{task}] → {fn.__name__}")
                    return result.strip()
            except Exception:
                continue
        return "أنا هنا معاك 💜"

    # ── البث المباشر ──────────────────────────────
    async def stream_reply(self, prompt: str, task: str = "general") -> AsyncGenerator[str, None]:
        if self.groq_client:
            try:
                stream = self.groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role":"user","content":prompt}],
                    temperature=0.7, max_tokens=150, stream=True
                )
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as e:
                logger.warning(f"Groq stream failed: {e}")
        full = await self.get_best_reply(prompt, task)
        yield full
