import os, logging, asyncio, time
from typing import Optional

logger = logging.getLogger("multi_ai")

class AIUnavailable(Exception):
    pass

class MultiAIClient:
    def __init__(self):
        self._openai = None
        self._groq_client = None
        self._genai_client = None
        self.max_retries = 2

    async def get_best_reply(self, prompt: str, task: str = "general", lang: str = "ar") -> str:
        providers = [self._try_groq, self._try_openrouter, self._try_gemini]
        last_error = None
        for provider in providers:
            for attempt in range(self.max_retries):
                try:
                    result = await provider(prompt)
                    if result and len(result) > 5:
                        return result
                except Exception as e:
                    last_error = e
                    logger.warning(f"Provider {provider.__name__} attempt {attempt+1} failed: {e}")
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                break
        raise AIUnavailable(f"All AI providers failed. Last error: {last_error}")

    async def _try_groq(self, prompt: str) -> Optional[str]:
        try:
            from openai import OpenAI
            key = os.getenv("GROQ_API_KEY")
            if not key:
                return None
            if not self._groq_client:
                self._groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=key)
            resp = self._groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500, temperature=0.7, timeout=10
            )
            return resp.choices[0].message.content
        except Exception:
            return None

    async def _try_openrouter(self, prompt: str) -> Optional[str]:
        try:
            from openai import OpenAI
            key = os.getenv("OPENROUTER_API_KEY")
            if not key:
                return None
            if not self._openai:
                self._openai = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
            resp = self._openai.chat.completions.create(
                model="meta-llama/llama-4-maverick",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500, temperature=0.7, timeout=10
            )
            return resp.choices[0].message.content
        except Exception:
            return None

    async def _try_gemini(self, prompt: str) -> Optional[str]:
        try:
            from google import genai
            key = os.getenv("GEMINI_API_KEY")
            if not key:
                return None
            if not self._genai_client:
                self._genai_client = genai.Client(api_key=key)
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._genai_client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config={"max_output_tokens": 500, "temperature": 0.7}
                )
            )
            if response and response.text:
                return response.text
        except Exception as e:
            logger.warning(f"Gemini error: {e}")
        return None
