"""Production LLM Providers with Tool Calling, Structured Output, and Resilient Fallback Chains.

Supported Providers:
- Groq (Ultra-fast Llama-3.3-70b-versatile, free tier ~30 RPM / 300+ tok/s)
- DeepSeek (deepseek-chat / deepseek-reasoner)
- OpenAI (GPT-4o / GPT-4)
- Anthropic (Claude 3.5 Sonnet / Claude 3 Opus)
- Ollama (Local open models: llama3, mistral)
- MockProvider (Deterministic offline testing & simulated tool loops)
- FallbackLLMProvider (Multi-tier automatic failover: Groq -> DeepSeek -> Ollama -> Mock)
"""

import abc
import json
import logging
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from src.asoc.core.config import settings

logger = logging.getLogger("asoc.llm")


# ── Structured Output Models ──────────────────────────────────────────────


class DetectionResult(BaseModel):
    threat_detected: bool = Field(default=True, description="Whether a security threat is detected")
    risk_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Risk score between 0.0 and 1.0")
    reasoning: str = Field(default="", description="Detailed threat rationale and evidence analysis")
    attack_technique: Optional[str] = Field(default=None, description="MITRE ATT&CK technique ID (e.g., T1078)")
    suggested_action: Optional[str] = Field(default=None, description="Recommended remediation action")


class ResponsePlan(BaseModel):
    actions: List[str] = Field(default_factory=list, description="Ordered list of containment actions to execute")
    approval_required: bool = Field(default=False, description="Whether human supervisor authorization is required")
    reasoning: str = Field(default="", description="Operational justification for the response plan")


class ForensicsSummary(BaseModel):
    compromised_assets: List[str] = Field(default_factory=list, description="List of identified compromised assets")
    iocs: List[str] = Field(default_factory=list, description="Extracted indicators of compromise (IP, domain, hash)")
    timeline_summary: str = Field(default="", description="Chronological summary of adversary progression")


class LLMResult:
    """Legacy backward-compatible container for analysis results."""

    def __init__(
        self,
        threat_detected: bool,
        risk_score: float,
        reasoning: str,
        attack_technique: Optional[str] = None,
        suggested_action: Optional[str] = None,
    ):
        self.threat_detected = threat_detected
        self.risk_score = max(0.0, min(1.0, risk_score))
        self.reasoning = reasoning
        self.attack_technique = attack_technique
        self.suggested_action = suggested_action

    def to_dict(self) -> Dict[str, Any]:
        return {
            "threat_detected": self.threat_detected,
            "risk_score": self.risk_score,
            "reasoning": self.reasoning,
            "attack_technique": self.attack_technique,
            "suggested_action": self.suggested_action,
        }


# ── Base Provider Interface ───────────────────────────────────────────────


PROMPT_TEMPLATE = """Analyze this security event for threats and adversarial activity.
Event: {event_json}

Return a valid JSON object with exactly these keys:
- threat_detected: boolean
- risk_score: float between 0.0 and 1.0
- reasoning: string explaining the analysis
- attack_technique: string (MITRE ATT&CK ID e.g. T1078, or null)
- suggested_action: string (e.g., "ISOLATE_HOST", "BLOCK_IP", or null)"""


class LLMProvider(abc.ABC):
    @property
    @abc.abstractmethod
    def name(self) -> str: ...

    @abc.abstractmethod
    async def analyze(self, event_data: dict) -> LLMResult:
        """Analyze security telemetry and return an LLMResult."""
        ...

    @abc.abstractmethod
    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        """Execute a chat completion with optional tool declarations.

        Returns a dict matching OpenAI message format:
        {
            "role": "assistant",
            "content": str or None,
            "tool_calls": [{"id": str, "function": {"name": str, "arguments": str}}] (optional)
        }
        """
        ...


# ── Mock Provider ─────────────────────────────────────────────────────────


class MockProvider(LLMProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def analyze(self, event_data: dict) -> LLMResult:
        event_name = event_data.get("eventName", event_data.get("event_name", "ConsoleLogin"))
        is_high = event_name in ("ConsoleLogin", "CreateUser", "DeleteBucket", "TerminateInstance")
        score = 0.88 if is_high else 0.45
        return LLMResult(
            threat_detected=is_high,
            risk_score=score,
            reasoning=f"Mock analysis: event '{event_name}' classified with high confidence.",
            attack_technique="T1078" if is_high else None,
            suggested_action="ISOLATE_HOST" if score > 0.8 else None,
        )

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        last_message = messages[-1]["content"] if messages else ""

        # If tools are available and this is the first user turn, simulate calling a tool
        has_tool_response = any(m.get("role") == "tool" for m in messages)
        if tools and not has_tool_response:
            first_tool = tools[0]["function"]["name"]
            return {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "mock-call-1",
                        "function": {
                            "name": first_tool,
                            "arguments": json.dumps({"query": "incident", "limit": 5}),
                        },
                    }
                ],
            }

        # Otherwise synthesize final structured answer
        return {
            "role": "assistant",
            "content": json.dumps(
                {
                    "threat_detected": True,
                    "risk_score": 0.85,
                    "reasoning": "Mock provider synthesized response based on tool telemetry.",
                    "attack_technique": "T1078",
                    "suggested_action": "ISOLATE_HOST",
                }
            ),
            "tool_calls": None,
        }


# ── Groq Provider (Fast Llama-3.3-70b-versatile) ──────────────────────────


class GroqProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def name(self) -> str:
        return f"groq:{self.model}"

    def _lazy_init(self):
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=self.api_key,
            )

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        self._lazy_init()
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0].message

        tool_calls = None
        if choice.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.tool_calls
            ]

        return {
            "role": "assistant",
            "content": choice.content,
            "tool_calls": tool_calls,
        }

    async def analyze(self, event_data: dict) -> LLMResult:
        prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
        res = await self.chat_with_tools(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
        )
        content = res.get("content", "{}")
        try:
            data = json.loads(content.strip())
        except Exception:
            # Fallback if wrapped in markdown codeblock
            if "```json" in content:
                content = content.split("```json")[-1].split("```")[0].strip()
                data = json.loads(content)
            elif "```" in content:
                content = content.split("```")[-1].split("```")[0].strip()
                data = json.loads(content)
            else:
                raise

        return LLMResult(
            threat_detected=bool(data.get("threat_detected", True)),
            risk_score=float(data.get("risk_score", 0.5)),
            reasoning=str(data.get("reasoning", "Groq analysis completed")),
            attack_technique=data.get("attack_technique"),
            suggested_action=data.get("suggested_action"),
        )


# ── DeepSeek Provider ─────────────────────────────────────────────────────


class DeepSeekProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def name(self) -> str:
        return f"deepseek:{self.model}"

    def _lazy_init(self):
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                base_url="https://api.deepseek.com/v1",
                api_key=self.api_key,
            )

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        self._lazy_init()
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0].message
        tool_calls = None
        if choice.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.tool_calls
            ]
        return {
            "role": "assistant",
            "content": choice.content,
            "tool_calls": tool_calls,
        }

    async def analyze(self, event_data: dict) -> LLMResult:
        prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
        res = await self.chat_with_tools(messages=[{"role": "user", "content": prompt}])
        content = res.get("content", "{}")
        try:
            data = json.loads(content.strip())
        except Exception:
            if "```json" in content:
                content = content.split("```json")[-1].split("```")[0].strip()
                data = json.loads(content)
            else:
                data = {"threat_detected": True, "risk_score": 0.5, "reasoning": content}

        return LLMResult(
            threat_detected=bool(data.get("threat_detected", True)),
            risk_score=float(data.get("risk_score", 0.5)),
            reasoning=str(data.get("reasoning", "DeepSeek analysis")),
            attack_technique=data.get("attack_technique"),
            suggested_action=data.get("suggested_action"),
        )


# ── OpenAI Provider ───────────────────────────────────────────────────────


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
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=self.api_key)

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        self._lazy_init()
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0].message
        tool_calls = None
        if choice.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.tool_calls
            ]
        return {"role": "assistant", "content": choice.content, "tool_calls": tool_calls}

    async def analyze(self, event_data: dict) -> LLMResult:
        prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
        res = await self.chat_with_tools(messages=[{"role": "user", "content": prompt}])
        result = json.loads(res.get("content", "{}").strip())
        return LLMResult(
            threat_detected=result.get("threat_detected", True),
            risk_score=result.get("risk_score", 0.5),
            reasoning=result.get("reasoning", "No reasoning provided"),
            attack_technique=result.get("attack_technique"),
            suggested_action=result.get("suggested_action"),
        )


# ── Anthropic Provider ────────────────────────────────────────────────────


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
            from anthropic import AsyncAnthropic

            self._client = AsyncAnthropic(api_key=self.api_key)

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        self._lazy_init()
        anthropic_messages = []
        system_content = ""
        for m in messages:
            if m["role"] == "system":
                system_content += m["content"] + "\n"
            else:
                anthropic_messages.append({"role": m["role"], "content": m.get("content", "")})

        kwargs: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": anthropic_messages,
        }
        if system_content:
            kwargs["system"] = system_content.strip()

        response = await self._client.messages.create(**kwargs)
        content = response.content[0].text if hasattr(response.content[0], "text") else str(response.content)
        return {"role": "assistant", "content": content, "tool_calls": None}

    async def analyze(self, event_data: dict) -> LLMResult:
        prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
        res = await self.chat_with_tools(messages=[{"role": "user", "content": prompt}])
        result = json.loads(res.get("content", "{}").strip())
        return LLMResult(
            threat_detected=result.get("threat_detected", True),
            risk_score=result.get("risk_score", 0.5),
            reasoning=result.get("reasoning", "No reasoning provided"),
            attack_technique=result.get("attack_technique"),
            suggested_action=result.get("suggested_action"),
        )


# ── Ollama Provider (Local) ───────────────────────────────────────────────


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
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(base_url=f"{self.base_url}/v1", api_key="ollama")

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        self._lazy_init()
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0].message
        tool_calls = None
        if choice.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.tool_calls
            ]
        return {"role": "assistant", "content": choice.content, "tool_calls": tool_calls}

    async def analyze(self, event_data: dict) -> LLMResult:
        prompt = PROMPT_TEMPLATE.format(event_json=json.dumps(event_data, indent=2))
        res = await self.chat_with_tools(messages=[{"role": "user", "content": prompt}])
        result = json.loads(res.get("content", "{}").strip())
        return LLMResult(
            threat_detected=result.get("threat_detected", True),
            risk_score=result.get("risk_score", 0.5),
            reasoning=result.get("reasoning", "No reasoning provided"),
            attack_technique=result.get("attack_technique"),
            suggested_action=result.get("suggested_action"),
        )


# ── Fallback Chain Provider ───────────────────────────────────────────────


class FallbackLLMProvider(LLMProvider):
    """Resilient multi-tier LLM provider with graceful degradation.

    Tries providers in sequence (e.g., Groq -> DeepSeek -> Ollama -> Mock).
    Maintains telemetry and prevents any single provider outage from blocking the SOC.
    """

    def __init__(self, providers: List[LLMProvider]):
        if not providers:
            raise ValueError("FallbackLLMProvider requires at least one provider")
        self.providers = providers
        self.active_provider_index = 0

    @property
    def name(self) -> str:
        chain_names = " -> ".join(p.name for p in self.providers)
        return f"fallback[{chain_names}]"

    async def analyze(self, event_data: dict) -> LLMResult:
        last_error = None
        for i, provider in enumerate(self.providers):
            try:
                res = await provider.analyze(event_data)
                if i > 0:
                    logger.warning(
                        "llm_fallback_used",
                        fallback_provider=provider.name,
                        primary=self.providers[0].name,
                    )
                return res
            except Exception as e:
                logger.error("provider_analyze_failed", provider=provider.name, error=str(e))
                last_error = e

        logger.critical("all_providers_failed_returning_mock", error=str(last_error))
        mock = MockProvider()
        return await mock.analyze(event_data)

    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        last_error = None
        for i, provider in enumerate(self.providers):
            try:
                res = await provider.chat_with_tools(messages, tools=tools, temperature=temperature)
                if i > 0:
                    logger.warning(
                        "llm_fallback_used_for_tools",
                        fallback_provider=provider.name,
                        primary=self.providers[0].name,
                    )
                return res
            except Exception as e:
                logger.error("provider_chat_failed", provider=provider.name, error=str(e))
                last_error = e

        logger.critical("all_providers_chat_failed_using_mock", error=str(last_error))
        mock = MockProvider()
        return await mock.chat_with_tools(messages, tools=tools, temperature=temperature)


# ── Provider Factory ──────────────────────────────────────────────────────


def create_llm_provider(
    provider_type: Optional[str] = None,
    prefer_fallback_chain: bool = True,
) -> LLMProvider:
    """Instantiate configured LLM provider or construct a resilient failover chain."""
    p_type = (provider_type or settings.LLM_PROVIDER).lower()

    # Collect available concrete providers based on environment secrets
    available: List[LLMProvider] = []

    # 1. Groq (Fastest)
    if settings.GROQ_API_KEY:
        available.append(
            GroqProvider(
                api_key=settings.GROQ_API_KEY.get_secret_value(),
                model="llama-3.3-70b-versatile",
            )
        )

    # 2. DeepSeek
    if settings.DEEPSEEK_API_KEY:
        available.append(
            DeepSeekProvider(
                api_key=settings.DEEPSEEK_API_KEY.get_secret_value(),
                model="deepseek-chat",
            )
        )

    # 3. OpenAI
    if settings.OPENAI_API_KEY:
        available.append(
            OpenAIProvider(
                api_key=settings.OPENAI_API_KEY.get_secret_value(),
                model=settings.LLM_MODEL,
            )
        )

    # 4. Anthropic
    if settings.ANTHROPIC_API_KEY:
        available.append(
            AnthropicProvider(
                api_key=settings.ANTHROPIC_API_KEY.get_secret_value(),
                model=settings.LLM_MODEL,
            )
        )

    # 5. Ollama
    if p_type in ("ollama", "local"):
        available.append(
            OllamaProvider(
                model=settings.LOCAL_LLM_MODEL,
                base_url=settings.LOCAL_LLM_BASE_URL,
            )
        )

    # If single specific provider was requested and is present:
    if not prefer_fallback_chain:
        for p in available:
            if p.name.startswith(p_type):
                return p

    # If we have available providers, construct failover chain ending in Mock
    if available:
        available.append(MockProvider())
        return FallbackLLMProvider(available)

    # If none configured, return MockProvider
    logger.warning("No LLM API keys configured. Using MockProvider.")
    return MockProvider()
