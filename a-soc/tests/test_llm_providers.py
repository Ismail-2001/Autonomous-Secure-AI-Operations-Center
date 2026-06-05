from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.llm.providers import (
    AnthropicProvider,
    LLMResult,
    MockProvider,
    OllamaProvider,
    OpenAIProvider,
    create_llm_provider,
)


class TestLLMResult:
    def test_clamps_risk_score_low(self):
        r = LLMResult(threat_detected=True, risk_score=-0.5, reasoning="test")
        assert r.risk_score == 0.0

    def test_clamps_risk_score_high(self):
        r = LLMResult(threat_detected=True, risk_score=1.5, reasoning="test")
        assert r.risk_score == 1.0

    def test_to_dict_includes_all_fields(self):
        r = LLMResult(threat_detected=True, risk_score=0.75, reasoning="suspicious", attack_technique="T1078")
        d = r.to_dict()
        assert d["risk_score"] == 0.75
        assert d["reasoning"] == "suspicious"
        assert d["attack_technique"] == "T1078"

    def test_to_dict_attack_technique_none(self):
        r = LLMResult(threat_detected=True, risk_score=0.5, reasoning="test")
        d = r.to_dict()
        assert d["attack_technique"] is None


@pytest.mark.asyncio
class TestMockProvider:
    async def test_analyze_returns_expected_risk(self):
        provider = MockProvider()
        result = await provider.analyze({"eventName": "ConsoleLogin"})
        assert result.risk_score == 0.85
        assert result.threat_detected is True
        assert "ConsoleLogin" in result.reasoning

    async def test_provider_name(self):
        assert MockProvider().name == "mock"


class TestCreateProvider:
    def test_mock_fallback_when_no_keys(self):
        with patch("core.llm.providers.settings") as mock_settings:
            mock_settings.LLM_PROVIDER = "openai"
            mock_settings.OPENAI_API_KEY = None
            mock_settings.LLM_MODEL = "gpt-4"
            provider = create_llm_provider()
            assert provider.name == "mock"

    def test_openai_provider_with_key(self):
        with patch("core.llm.providers.settings") as mock_settings:
            mock_settings.LLM_PROVIDER = "openai"
            mock_settings.OPENAI_API_KEY = MagicMock()
            mock_settings.OPENAI_API_KEY.get_secret_value.return_value = "sk-test"
            mock_settings.LLM_MODEL = "gpt-4"
            provider = create_llm_provider()
            assert provider.name == "openai:gpt-4"

    def test_anthropic_provider_with_key(self):
        with patch("core.llm.providers.settings") as mock_settings:
            mock_settings.LLM_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = MagicMock()
            mock_settings.ANTHROPIC_API_KEY.get_secret_value.return_value = "sk-ant-test"
            mock_settings.LLM_MODEL = "claude-3-opus-20240229"
            provider = create_llm_provider()
            assert provider.name.startswith("anthropic:")

    def test_ollama_provider(self):
        with patch("core.llm.providers.settings") as mock_settings:
            mock_settings.LLM_PROVIDER = "ollama"
            mock_settings.LOCAL_LLM_MODEL = "llama3"
            mock_settings.LOCAL_LLM_BASE_URL = "http://localhost:11434"
            with patch("core.llm.providers.OllamaProvider") as MockOllama:
                MockOllama.return_value.name = "ollama:llama3"
                provider = create_llm_provider()
                assert provider.name == "ollama:llama3"

    def test_local_provider_uses_ollama(self):
        with patch("core.llm.providers.settings") as mock_settings:
            mock_settings.LLM_PROVIDER = "local"
            mock_settings.LOCAL_LLM_MODEL = "llama3"
            mock_settings.LOCAL_LLM_BASE_URL = "http://localhost:11434"
            with patch("core.llm.providers.OllamaProvider") as MockOllama:
                MockOllama.return_value.name = "ollama:llama3"
                provider = create_llm_provider()
                assert provider.name == "ollama:llama3"


@pytest.mark.asyncio
class TestOpenAIProvider:
    async def test_analyze_success(self):
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = (
            '{"threat_detected": true, "risk_score": 0.92, "reasoning": "Test", "attack_technique": "T1078"}'
        )
        mock_completion.choices = [mock_choice]
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        provider = OpenAIProvider(api_key="sk-test")
        provider._client = mock_client

        result = await provider.analyze({"eventName": "ConsoleLogin"})
        assert result.risk_score == 0.92
        assert result.reasoning == "Test"
        assert result.attack_technique == "T1078"

    async def test_analyze_throws_on_invalid_json(self):
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "not json"
        mock_completion.choices = [mock_choice]
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        provider = OpenAIProvider(api_key="sk-test")
        provider._client = mock_client

        with pytest.raises(Exception):
            await provider.analyze({"eventName": "ConsoleLogin"})

    async def test_provider_name(self):
        provider = OpenAIProvider(api_key="sk-test", model="gpt-4")
        assert provider.name == "openai:gpt-4"


@pytest.mark.asyncio
class TestAnthropicProvider:
    async def test_analyze_success(self):
        mock_client = MagicMock()
        mock_content_block = MagicMock()
        mock_content_block.text = (
            '{"threat_detected": true, "risk_score": 0.88, "reasoning": "Test claude", "attack_technique": "T1098"}'
        )
        mock_response = MagicMock()
        mock_response.content = [mock_content_block]
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        provider = AnthropicProvider(api_key="sk-ant-test")
        provider._client = mock_client

        result = await provider.analyze({"eventName": "CreateUser"})
        assert result.risk_score == 0.88
        assert result.attack_technique == "T1098"

    async def test_provider_name(self):
        provider = AnthropicProvider(api_key="sk-ant-test", model="claude-3-opus-20240229")
        assert provider.name == "anthropic:claude-3-opus-20240229"


@pytest.mark.asyncio
class TestOllamaProvider:
    async def test_analyze_success(self):
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = (
            '{"threat_detected": true, "risk_score": 0.72, "reasoning": "Local LLM analysis", "attack_technique": null}'
        )
        mock_completion.choices = [mock_choice]
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)

        provider = OllamaProvider(model="llama3")
        provider._client = mock_client

        result = await provider.analyze({"eventName": "ConsoleLogin"})
        assert result.risk_score == 0.72
        assert result.reasoning == "Local LLM analysis"
        assert result.attack_technique is None

    async def test_analyze_throws_when_not_installed(self):
        provider = OllamaProvider(model="llama3")
        with patch("core.llm.providers.OllamaProvider._lazy_init", side_effect=ImportError("not installed")):
            with pytest.raises(ImportError):
                await provider.analyze({"eventName": "ConsoleLogin"})

    async def test_provider_name(self):
        provider = OllamaProvider(model="llama3")
        assert provider.name == "ollama:llama3"
