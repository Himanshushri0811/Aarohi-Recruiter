"""
Gemini LLM provider using the generativelanguage.googleapis.com REST API.

Uses gemini-3.7-flash as the primary model (confirmed working with this key type).
Falls back gracefully with retry on 503.
"""

import json
import logging

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.providers.interfaces import LLMProvider, LLMResponse, Message

logger = logging.getLogger(__name__)

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiLLMProvider(LLMProvider):
    """
    Calls the Gemini generateContent REST endpoint.

    Key notes:
    - API key starts with 'AQ.' — this is an Interactions API key, works the same way.
    - Primary model: gemini-3.7-flash (confirmed working).
    - Retry on 503 (high demand) up to 3 times with exponential backoff.
    """

    def __init__(self, api_key: str, model: str = "gemini-3.1-flash-lite", timeout: float = 60.0):
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.HTTPStatusError),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: list[Message] | None = None,
        response_json: bool = False,
    ) -> LLMResponse:
        contents = []

        # Build conversation history
        if history:
            for msg in history:
                role = "user" if msg.role == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg.content}]})

        # Add current user prompt
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload: dict = {"contents": contents}

        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        if response_json:
            payload["generationConfig"] = {"responseMimeType": "application/json"}

        url = f"{_GEMINI_BASE}/{self._model}:generateContent"

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = client.post(url, params={"key": self._api_key}, json=payload)
            resp = await resp if hasattr(resp, "__await__") else resp
            resp.raise_for_status()

        data = resp.json()

        # Extract text from response
        try:
            candidate = data["candidates"][0]
            text = candidate["content"]["parts"][0]["text"]
            finish_reason = candidate.get("finishReason", "STOP")
        except (KeyError, IndexError) as e:
            logger.error("Unexpected Gemini response structure: %s", data)
            raise RuntimeError(f"Failed to parse Gemini response: {e}") from e

        usage = data.get("usageMetadata", {})
        return LLMResponse(
            text=text,
            model=self._model,
            input_tokens=usage.get("promptTokenCount", 0),
            output_tokens=usage.get("candidatesTokenCount", 0),
            finish_reason=finish_reason,
        )

    async def health_check(self) -> bool:
        try:
            result = await self.generate("Reply with the single word: OK")
            return "ok" in result.text.lower()
        except Exception as e:
            logger.warning("Gemini LLM health check failed: %s", e)
            return False
