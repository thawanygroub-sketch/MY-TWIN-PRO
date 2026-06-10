import os, logging, asyncio, warnings
from typing import Optional, AsyncGenerator

warnings.filterwarnings("ignore", message="All support for the `google.generativeai` package has ended")
import google.generativeai as genai
from openai import OpenAI

logger = logging.getLogger("multi_ai")

class AIUnavailable(Exception):
    pass

class MultiAIClient:
    def __init__(self):
        # Gemini 1.5 Flash (local fallback – مجاني من Google AI Studio)
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

        # Groq
        groq_key = os.getenv("GROQ_API_KEY")
        self.groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=groq_key) if groq_key else None

        # OpenRouter
        or_key = os.getenv("OPENROUTER_API_KEY")
        self.or_client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=or_key) if or_key else None

    # ── أدوات الاتصال ──────────────────────────────
    def _groq(self, model: str, prompt: str, max_tokens: int = 100) -> Optional[str]:
        if not self.groq_client: return None
        try:
            resp = self.groq_client.chat.completions.create(
                model=model, messages=[{"role":"user","content":prompt}],
                temperature=0.7, max_tokens=max_tokens
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"Groq [{model}]: {e}")
            return None

    def _or(self, model: str, prompt: str, max_tokens: int = 100) -> Optional[str]:
        if not self.or_client: return None
        try:
            resp = self.or_client.chat.completions.create(
                model=model, messages=[{"role":"user","content":prompt}],
                temperature=0.7, max_tokens=max_tokens
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenRouter [{model}]: {e}")
            return None

    # ── Groq Models ─────────────────────────────────
    def groq_llama(self, p, max_t=100):   return self._groq("llama-3.3-70b-versatile", p, max_t)
    def groq_gemma(self, p, max_t=80):    return self._groq("gemma2-9b-it", p, max_t)  # خفيف وسريع

    # ── OpenRouter Models ────────────────────────────
    def or_llama4(self, p, max_t=100):    return self._or("meta-llama/llama-4-maverick", p, max_t)
    def or_deepseek(self, p, max_t=120):  return self._or("deepseek/deepseek-v4-flash", p, max_t)
    def or_kimi(self, p, max_t=100):      return self._or("moonshotai/kimi-k2.6:free", p, max_t)
    def or_mistral(self, p, max_t=100):   return self._or("mistralai/mistral-small-3.1-24b-instruct", p, max_t)
    def or_gemma(self, p, max_t=80):      return self._or("google/gemma-2-9b-it:free", p, max_t)  # خفيف وسريع

    # ── Gemini (احتياطي نهائي) ──────────────────────
    def gemini_chat(self, p: str, max_t: int = 100) -> str:
        if not self.gemini_flash:
            return "أنا هنا معاك 💜"
        try:
            genai.GenerationConfig(temperature=0.7, max_output_tokens=max_t)
            resp = self.gemini_flash.generate_content(p)
            return resp.text.strip() if resp.text else "أنا هنا معاك 💜"
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return "أنا هنا معاك 💜"

    # ── توزيع المهام الذكي (3 نماذج + احتياطي لكل مهمة) ──
    async def get_best_reply(self, prompt: str, task: str = "general") -> str:
        # تقدير عدد التوكنات المناسب بناءً على طول prompt المدخل
        estimated_tokens = max(60, min(150, len(prompt) // 2))

        chains = {
            # كل سلسلة: [Primary, Secondary, Tertiary, Quaternary (Gemini fallback)]
            "general": [
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.or_kimi(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "emotional": [
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_kimi(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "coding": [
                lambda p: self.or_deepseek(p, estimated_tokens),
                lambda p: self.or_mistral(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "deep_reasoning": [
                lambda p: self.or_deepseek(p, estimated_tokens),
                lambda p: self.or_kimi(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "multilingual": [
                lambda p: self.or_kimi(p, estimated_tokens),
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "planning": [
                lambda p: self.or_kimi(p, estimated_tokens),
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "coaching": [
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.or_kimi(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "dream": [
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_gemma(p, min(80, estimated_tokens)),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "music": [
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.or_gemma(p, min(80, estimated_tokens)),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "video": [
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_llama4(p, estimated_tokens),
                lambda p: self.or_gemma(p, min(80, estimated_tokens)),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "search": [
                lambda p: self.or_deepseek(p, estimated_tokens),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.or_mistral(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
            "agent": [
                lambda p: self.or_mistral(p, estimated_tokens),
                lambda p: self.groq_gemma(p, min(80, estimated_tokens)),
                lambda p: self.groq_llama(p, estimated_tokens),
                lambda p: self.gemini_chat(p, estimated_tokens),
            ],
        }

        selected = chains.get(task, chains["general"])
        loop = asyncio.get_running_loop()
        for i, fn in enumerate(selected):
            try:
                result = await loop.run_in_executor(None, fn, prompt)
                if result and len(result.strip()) >= 1:
                    logger.info(f"✅ [{task}] → model {i+1}")
                    return result.strip()
            except Exception:
                continue
        return "أنا هنا معاك 💜"

    # ── البث المباشر ──────────────────────────────────
    async def stream_reply(self, prompt: str, task: str = "general") -> AsyncGenerator[str, None]:
        if self.groq_client:
            try:
                stream = self.groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role":"user","content":prompt}],
                    temperature=0.7, max_tokens=100, stream=True
                )
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception as e:
                logger.warning(f"Groq stream failed: {e}")
        full = await self.get_best_reply(prompt, task)
        yield full
