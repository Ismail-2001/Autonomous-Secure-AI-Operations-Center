import abc
import json
import logging
from typing import Any, Dict, Optional

from core.config.settings import settings

logger = logging.getLogger("asoc.llm")


class LLMResult:
    def __init__(
        self, threat_detected: bool, risk_score: float, reasoning: str, attack_technique: Optional[str] = None
    ):
        self.threat_detected = threat_detected
        self.risk_score = max(0.0, min(1.0, risk_score))
        self.reasoning = reasoning
        self.attack_technique = attack_technique

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": self.risk_score,
            "reasoning": self.reasoning,
            "attack_technique": self.attack_technique,
        }


class LLMProvider(abc.ABC):
    @abc.abstractmethod
    async def analyze(self, event_data: dict) -> LLMResult: ...

    @property
    @abc.abstractmethod
    def name(self) -> str: ...


class MockProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def analyze(self, event_data: dict) -> LLMResult:
        return LLMResult(
            threat_detected=True,
            risk_score=0.85,
            reasoning="Suspicious ConsoleLogin from unusual IP address (1.2.3.4)",
        )


PROMPT_TEMPLATE = """Analyze this AWS CloudTrail event for security threats.
Event: {event_json}

Return a JSON object with exactly these fields:
- threat_detected: boolean
- risk_score: float between 0.0 and 1.0
- reasoning: string explaining the analysis
- attack_technique: string (MITRE ATT&CK ID if applicable, or null)"""


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4"):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def name(self) -> str:
        return f"openai:{self.model}"

    def _lazy_init(self):
        if self._client is None:
            from langchain_openai import ChatOpenAI

            self._client = ChatOpenAI(model=self.model, temperature=0, api_key=self.api_key)

    async def analyze(self, event_data: dict) -> LLMResult:
        self._lazy_init()
        try:
            from langchain.schema import HumanMessage

            prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
            response = await self._client.ainvoke([HumanMessage(content=prompt)])
            result = json.loads(response.content.strip())
            return LLMResult(
                threat_detected=result.get("threat_detected", True),
                risk_score=result.get("risk_score", 0.5),
                reasoning=result.get("reasoning", "No reasoning provided"),
                attack_technique=result.get("attack_technique"),
            )
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            raise


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-3-opus-20240229"):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def name(self) -> str:
        return f"anthropic:{self.model}"

    def _lazy_init(self):
        if self._client is None:
            from langchain_anthropic import ChatAnthropic

            self._client = ChatAnthropic(model=self.model, temperature=0, api_key=self.api_key)

    async def analyze(self, event_data: dict) -> LLMResult:
        self._lazy_init()
        try:
            from langchain.schema import HumanMessage

            prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
            response = await self._client.ainvoke([HumanMessage(content=prompt)])
            result = json.loads(response.content.strip())
            return LLMResult(
                threat_detected=result.get("threat_detected", True),
                risk_score=result.get("risk_score", 0.5),
                reasoning=result.get("reasoning", "No reasoning provided"),
                attack_technique=result.get("attack_technique"),
            )
        except Exception as e:
            logger.error(f"Anthropic analysis failed: {e}")
            raise


class OllamaProvider(LLMProvider):
    def __init__(self, model: str = "llama3", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url
        self._client = None

    @property
    def name(self) -> str:
        return f"ollama:{self.model}"

    def _lazy_init(self):
        if self._client is None:
            try:
                from langchain_ollama import ChatOllama

                self._client = ChatOllama(model=self.model, temperature=0, num_predict=2048, base_url=self.base_url)
            except ImportError:
                logger.warning("langchain-ollama not installed. Install with: pip install langchain-ollama")
                raise

    async def analyze(self, event_data: dict) -> LLMResult:
        self._lazy_init()
        try:
            from langchain.schema import HumanMessage

            prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
            response = await self._client.ainvoke([HumanMessage(content=prompt)])
            result = json.loads(response.content.strip())
            return LLMResult(
                threat_detected=result.get("threat_detected", True),
                risk_score=result.get("risk_score", 0.5),
                reasoning=result.get("reasoning", "No reasoning provided"),
                attack_technique=result.get("attack_technique"),
            )
        except Exception as e:
            logger.error(f"Ollama analysis failed: {e}")
            raise


def create_llm_provider() -> LLMProvider:
    provider_type = settings.LLM_PROVIDER

    if provider_type == "openai" and settings.OPENAI_API_KEY:
        return OpenAIProvider(api_key=settings.OPENAI_API_KEY.get_secret_value(), model=settings.LLM_MODEL)

    if provider_type == "anthropic" and settings.ANTHROPIC_API_KEY:
        return AnthropicProvider(api_key=settings.ANTHROPIC_API_KEY.get_secret_value(), model=settings.LLM_MODEL)

    if provider_type in ("ollama", "local"):
        return OllamaProvider(model=settings.LOCAL_LLM_MODEL, base_url=settings.LOCAL_LLM_BASE_URL)

    logger.warning(f"No valid LLM provider configured for '{provider_type}'. Using mock fallback.")
    return MockProvider()
