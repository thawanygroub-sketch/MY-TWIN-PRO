import os, logging, asyncio, time, random, warnings
from typing import Optional, AsyncGenerator, List, Tuple

warnings.filterwarnings("ignore", message="All support for the `google.generativeai` package has ended")
import google.generativeai as genai
from openai import OpenAI
from model_registry import TASK_CHAINS, MODEL_COSTS, MODEL_LATENCY_ESTIMATE, FALLBACK_MESSAGES

logger = logging.getLogger("multi_ai")

class AIUnavailable(Exception):
    pass

class MultiAIClient:
    def __init__(self):
        # Gemini 3.1 Flash Lite (1000 طلب/يوم مجاناً)
        gemini_key = self._get_balanced_key("gemini")
        self.gemini_model = None
        if gemini_key:
            try:
                genai.configure(api_key=gemini_key)
                self.gemini_model = genai.GenerativeModel("gemini-3.1-flash-lite")
            except Exception as e:
                logger.error(f"Gemini init failed: {e}")

        # Groq
        groq_key = os.getenv("GROQ_API_KEY")
        self.groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=groq_key) if groq_key else None

        # OpenRouter
        or_key = os.getenv("OPENROUTER_API_KEY")
        self.or_client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=or_key) if or_key else None

    async def _call_model(self, provider: str, model: str, prompt: str, max_t: int, timeout: int = 8) -> Tuple[Optional[str], str, float, int]:
        start = time.time()
        try:
            if provider == "groq" and self.groq_client:
                resp = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, 
                        lambda: self.groq_client.chat.completions.create(
                            model=model.split("/")[-1],
                            messages=[{"role":"user","content":prompt}],
                            temperature=0.8, max_tokens=max_t
                        )
                    ),
                    timeout=timeout
                )
                result = resp.choices[0].message.content
                latency = (time.time() - start) * 1000
                return result.strip() if result else None, "Groq", latency, 0

            elif provider == "openrouter" and self.or_client:
                resp = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.or_client.chat.completions.create(
                            model=model.split("/", 1)[-1],
                            messages=[{"role":"user","content":prompt}],
                            temperature=0.8, max_tokens=max_t
                        )
                    ),
                    timeout=timeout
                )
                result = resp.choices[0].message.content
                latency = (time.time() - start) * 1000
                return result.strip() if result else None, "OpenRouter", latency, 0

            elif provider == "gemini" and self.gemini_model:
                resp = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.gemini_model.generate_content(
                            prompt,
                            generation_config=genai.GenerationConfig(temperature=0.8, max_output_tokens=max_t)
                        )
                    ),
                    timeout=timeout
                )
                result = resp.text
                latency = (time.time() - start) * 1000
                return result.strip() if result else None, "Gemini", latency, 0

        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Model {provider}/{model} failed: {e}")
        
        return None, provider, 0, 0

    async def get_best_reply(self, prompt: str, task: str = "general") -> str:
        chains = TASK_CHAINS.get(task, TASK_CHAINS["general"])
        
        tasks = []
        for i, model_spec in enumerate(chains[:3]):
            parts = model_spec.split("/", 1)
            provider = parts[0]
            model = parts[1]
            max_t = max(60, min(150, len(prompt) // 2))
            timeout = int(MODEL_LATENCY_ESTIMATE.get(provider, 3.0) * 2)
            tasks.append(self._call_model(provider, model, prompt, max_t, timeout))

        pending = set(tasks)
        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                result, provider, latency, cost = task.result()
                if result and len(result.strip()) >= 1:
                    logger.info(f"✅ [{task}] → {provider} ({latency:.0f}ms)")
                    return result.strip()

        if len(chains) > 3:
            parts = chains[3].split("/", 1)
            result, provider, latency, cost = await self._call_model(parts[0], parts[1], prompt, 100, 10)
            if result:
                return result.strip()

        return random.choice(FALLBACK_MESSAGES)

    async def stream_reply(self, prompt: str, task: str = "general") -> AsyncGenerator[str, None]:
        if self.groq_client:
            try:
                stream = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self.groq_client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[{"role":"user","content":prompt}],
                            temperature=0.8, max_tokens=100, stream=True
                        )
                    ),
                    timeout=5
                )
                if stream:
                    for chunk in stream:
                        if chunk.choices[0].delta.content:
                            yield chunk.choices[0].delta.content
                    return
            except Exception as e:
                logger.warning(f"Groq stream failed: {e}")
        
        full = await self.get_best_reply(prompt, task)
        yield full

    def generate_image(self, prompt: str) -> Optional[str]:
        image_key = os.getenv("GEMINI_IMAGE_API_KEY", os.getenv("GEMINI_API_KEY", ""))
        if not image_key:
            logger.warning("No Gemini image API key configured")
            return None
        try:
            genai.configure(api_key=image_key)
            model = genai.GenerativeModel("gemini-2.5-flash-image")
            response = model.generate_content(prompt)
            if response.parts and hasattr(response.parts[0], 'inline_data'):
                return response.parts[0].inline_data.data
        except Exception as e:
            logger.warning(f"Image generation failed: {e}")
        return None

    def _get_balanced_key(self, provider: str) -> Optional[str]:
        keys_map = {
            "groq": ["GROQ_API_KEY", "GROQ_API_KEY_2"],
            "openrouter": ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY_2"],
            "gemini": ["GEMINI_API_KEY", "GEMINI_API_KEY_2"],
        }
        key_names = keys_map.get(provider, [])
        valid_keys = [os.getenv(k) for k in key_names if os.getenv(k)]
        if not valid_keys:
            return None
        if len(valid_keys) == 1:
            return valid_keys[0]
        index = hash(str(time.time())) % len(valid_keys)
        return valid_keys[index]
