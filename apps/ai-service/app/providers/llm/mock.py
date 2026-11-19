"""
Mock LLM provider for unit tests.
Returns deterministic responses without calling any external APIs.
"""

from app.providers.interfaces import LLMProvider, LLMResponse, Message


class MockLLMProvider(LLMProvider):
    """In-process mock LLM for automated tests only."""

    def __init__(self, response_text: str = "Mock LLM response"):
        self._response_text = response_text

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: list[Message] | None = None,
        response_json: bool = False,
    ) -> LLMResponse:
        if response_json:
            text = '{"mock": true, "response": "' + self._response_text + '"}'
        else:
            text = self._response_text
        return LLMResponse(text=text, model="mock", input_tokens=10, output_tokens=5)

    async def health_check(self) -> bool:
        return True
