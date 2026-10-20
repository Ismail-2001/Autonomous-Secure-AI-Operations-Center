"""Phase 2 Comprehensive Test Suite: LLM Providers, Failover Chains, Tool Calling & Security Tools.

Validates:
1. Groq, DeepSeek, and Mock LLM providers
2. Resilient failover chain (FallbackLLMProvider)
3. Structured output models (DetectionResult, ResponsePlan, ForensicsSummary)
4. Autonomous agent tool calling loop (BaseAgent._run_tool_loop)
5. Real operational security tools (SIEM search, threat intel lookup, host quarantine, MITRE mapping)
6. Dynamic threat intel integration into DetectionAgent reasoning
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.detection import DetectionAgent
from src.asoc.agents.security_tools import (
    lookup_mitre_technique,
    lookup_threat_intel,
    network_quarantine_host,
    query_siem_events,
)
from src.asoc.agents.tools import ToolRegistry
from src.asoc.llm.providers import (
    DeepSeekProvider,
    DetectionResult,
    FallbackLLMProvider,
    ForensicsSummary,
    GroqProvider,
    LLMResult,
    MockProvider,
    ResponsePlan,
    create_llm_provider,
)


# ── 1. Provider Initialization & Interface ────────────────────────────────


class TestLLMProviders:
    def test_provider_names_and_structure(self):
        groq = GroqProvider(api_key="gsk-mock", model="llama-3.3-70b-versatile")
        assert groq.name == "groq:llama-3.3-70b-versatile"

        deepseek = DeepSeekProvider(api_key="dsk-mock", model="deepseek-chat")
        assert deepseek.name == "deepseek:deepseek-chat"

        mock = MockProvider()
        assert mock.name == "mock"

    @pytest.mark.asyncio
    async def test_mock_provider_tool_chat_simulation(self):
        mock = MockProvider()
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "lookup_threat_intel",
                    "description": "Lookup IOC",
                    "parameters": {"type": "object", "properties": {"indicator": {"type": "string"}}},
                },
            }
        ]
        # First turn: returns tool call
        resp1 = await mock.chat_with_tools([{"role": "user", "content": "Check IP 185.220.101.45"}], tools=tools)
        assert resp1["tool_calls"] is not None
        assert resp1["tool_calls"][0]["function"]["name"] == "lookup_threat_intel"

        # Second turn (with tool response): returns final content
        resp2 = await mock.chat_with_tools(
            [
                {"role": "user", "content": "Check IP 185.220.101.45"},
                {"role": "assistant", "tool_calls": resp1["tool_calls"]},
                {"role": "tool", "content": json.dumps({"found": True, "severity": "critical"})},
            ],
            tools=tools,
        )
        assert resp2["tool_calls"] is None
        assert "threat_detected" in resp2["content"]


# ── 2. Resilient Failover Chain ───────────────────────────────────────────


class TestFailoverChain:
    @pytest.mark.asyncio
    async def test_fallback_chain_degrades_gracefully_to_mock(self):
        class FailingProvider(GroqProvider):
            async def analyze(self, event_data: dict) -> LLMResult:
                raise ConnectionError("Rate limit exceeded 429")

            async def chat_with_tools(self, messages, tools=None, temperature=0.0):
                raise TimeoutError("Provider gateway timed out 504")

        failing1 = FailingProvider(api_key="fake", model="failing-1")
        failing2 = FailingProvider(api_key="fake", model="failing-2")
        mock = MockProvider()

        fallback = FallbackLLMProvider([failing1, failing2, mock])
        assert "fallback[" in fallback.name

        # 1. Test analyze() fallback
        result = await fallback.analyze({"eventName": "ConsoleLogin"})
        assert result.threat_detected is True
        assert result.risk_score > 0.5

        # 2. Test chat_with_tools() fallback
        chat_res = await fallback.chat_with_tools([{"role": "user", "content": "test"}])
        assert chat_res is not None
        assert "role" in chat_res


# ── 3. Structured Output Models ───────────────────────────────────────────


class TestStructuredOutputModels:
    def test_detection_result_validation(self):
        valid = DetectionResult(
            threat_detected=True,
            risk_score=0.92,
            reasoning="Anomalous SMB lateral movement detected",
            attack_technique="T1021.002",
            suggested_action="ISOLATE_HOST",
        )
        assert valid.risk_score == 0.92

        # Invalid risk score out of bounds
        with pytest.raises(ValidationError):
            DetectionResult(threat_detected=True, risk_score=1.5, reasoning="invalid")

    def test_response_plan_validation(self):
        plan = ResponsePlan(
            actions=["ISOLATE_INSTANCE", "REVOKE_IAM"],
            approval_required=True,
            reasoning="High blast radius containment",
        )
        assert len(plan.actions) == 2
        assert plan.approval_required is True

    def test_forensics_summary_validation(self):
        forensics = ForensicsSummary(
            compromised_assets=["AST-001", "AST-002"],
            iocs=["185.220.101.45"],
            timeline_summary="Initial compromise at 02:00 UTC",
        )
        assert len(forensics.compromised_assets) == 2


# ── 4. Autonomous Agent Tool Loop ─────────────────────────────────────────


class DummyTestAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="DummyAgent", description="Test agent for autonomous tool loop")

    def _register_default_tools(self):
        self.tool_registry.register(
            name="ping_host",
            func=self._tool_ping,
            description="Ping a host",
            input_schema={"host": {"type": "string"}},
        )
        self.tool_registry.register(
            name="restricted_nuke",
            func=self._tool_nuke,
            description="Restricted tool",
            input_schema={"target": {"type": "string"}},
            requires_authorization=True,
        )

    async def _tool_ping(self, host: str):
        return {"alive": True, "latency_ms": 12, "host": host}

    async def _tool_nuke(self, target: str):
        return {"nuked": target}


class TestAutonomousToolLoop:
    @pytest.mark.asyncio
    async def test_tool_loop_executes_and_returns_summary(self):
        agent = DummyTestAgent()
        provider = MockProvider()

        result = await agent._run_tool_loop(
            provider=provider,
            prompt="Investigate target host 10.0.0.5",
            system_prompt="You are a test security agent.",
            max_turns=3,
        )

        assert "final_content" in result
        assert "executed_tool_calls" in result
        assert result["turns"] >= 1
        assert len(result["executed_tool_calls"]) >= 1
        assert result["executed_tool_calls"][0]["tool"] == "ping_host"


# ── 5. Real Operational Security Tools ────────────────────────────────────


class TestOperationalSecurityTools:
    @pytest.mark.asyncio
    async def test_lookup_threat_intel_known_and_unknown(self):
        # Known threat
        known = await lookup_threat_intel("185.220.101.45")
        assert known["found"] is True
        assert known["severity"] == "critical"
        assert "conti" in known["tags"]

        # Unknown benign IP
        unknown = await lookup_threat_intel("8.8.8.8")
        assert unknown["found"] is False
        assert unknown["severity"] == "low"

    @pytest.mark.asyncio
    async def test_network_quarantine_idempotent_execution(self):
        incident_id = "INC-SEC-TOOL-001"
        host = "AST-042"

        # First quarantine execution -> executes
        res1 = await network_quarantine_host(host, incident_id=incident_id)
        assert res1["action"] == "quarantine_host"
        assert res1["executed_now"] is True

        # Second quarantine execution -> skipped via idempotency
        res2 = await network_quarantine_host(host, incident_id=incident_id)
        assert res2["action"] == "quarantine_host"
        assert res2["executed_now"] is False

    @pytest.mark.asyncio
    async def test_lookup_mitre_technique(self):
        res = await lookup_mitre_technique("T1078")
        assert res["found"] is True
        assert "Valid Accounts" in res["name"]


# ── 6. DetectionAgent Reasoning with Dynamic Tools ────────────────────────


class TestDetectionAgentReasoning:
    @pytest.mark.asyncio
    async def test_reasoning_detects_ip_and_adds_threat_intel_tool(self):
        agent = DetectionAgent()
        event_with_ip = {
            "eventName": "ConsoleLogin",
            "sourceIPAddress": "185.220.101.45",
        }
        state = {"messages": [], "is_authorized": False}
        perceived = {"event_data": event_with_ip}

        suggested = await agent.reason(state, perceived)
        tool_names = [call["tool"] for call in suggested]

        assert "lookup_threat_intel" in tool_names
        assert "analyze_threat_llm" in tool_names
        assert "map_mitre_technique" in tool_names
