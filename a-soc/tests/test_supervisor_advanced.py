import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.asoc.agents.agent_message import (
    AgentMessage,
    AgentType,
    MessageBus,
    MessagePriority,
    MessageType,
    RunContext,
    get_message_bus,
)
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState, create_initial_state
from src.asoc.agents.supervisor import (
    EscalationLevel,
    EscalationPolicy,
    QualityGate,
    QualityGateResult,
    SupervisorAgent,
)


def _make_obs(
    agent_id: str = "DetectionAgent",
    confidence: float = 0.8,
    risk: float = 0.5,
    tools: list = None,
    error: str = None,
    metadata: dict = None,
) -> AgentObservation:
    return AgentObservation(
        agent_id=agent_id,
        action_taken="test_action",
        confidence_score=confidence,
        tools_used=tools or ["test_tool"],
        next_state=ObservationNextState.CONTINUE,
        risk_score=risk,
        metadata=metadata or {"risk_score": risk},
        error=error,
    )


def _make_state(**overrides) -> AgentState:
    state = create_initial_state()
    state.update(overrides)
    return state


# ── RunContext Tests ─────────────────────────────────────────────────────────


class TestRunContext:
    def test_create_run_context(self):
        ctx = RunContext(incident_id="inc-001")
        assert ctx.incident_id == "inc-001"
        assert ctx.run_id is not None
        assert ctx.final_status == "in_progress"
        assert ctx.steps_completed == []
        assert ctx.steps_failed == []

    def test_record_step_success(self):
        ctx = RunContext(incident_id="inc-001")
        ctx.record_step("detection", True)
        assert "detection" in ctx.steps_completed
        assert ctx.steps_failed == []
        assert ctx.success_rate == 1.0

    def test_record_step_failure(self):
        ctx = RunContext(incident_id="inc-001")
        ctx.record_step("detection", False, {"error": "timeout"})
        assert ctx.steps_completed == []
        assert "detection" in ctx.steps_failed
        assert ctx.success_rate == 0.0

    def test_record_retry(self):
        ctx = RunContext(incident_id="inc-001")
        assert ctx.record_retry("DetectionAgent") == 1
        assert ctx.record_retry("DetectionAgent") == 2
        assert ctx.get_retry_count("DetectionAgent") == 2

    def test_can_retry(self):
        ctx = RunContext(incident_id="inc-001", max_retries=3)
        assert ctx.can_retry("DetectionAgent") is True
        ctx.record_retry("DetectionAgent")
        ctx.record_retry("DetectionAgent")
        ctx.record_retry("DetectionAgent")
        assert ctx.can_retry("DetectionAgent") is False

    def test_record_escalation(self):
        ctx = RunContext(incident_id="inc-001")
        ctx.record_escalation("DetectionAgent", "SupervisorAgent", "low confidence")
        assert len(ctx.escalation_history) == 1
        assert ctx.escalation_history[0]["from"] == "DetectionAgent"

    def test_mark_complete(self):
        ctx = RunContext(incident_id="inc-001")
        ctx.mark_complete("completed")
        assert ctx.final_status == "completed"

    def test_duration_seconds(self):
        ctx = RunContext(incident_id="inc-001")
        assert ctx.duration_seconds >= 0

    def test_success_rate_mixed(self):
        ctx = RunContext(incident_id="inc-001")
        ctx.record_step("a", True)
        ctx.record_step("b", True)
        ctx.record_step("c", False)
        assert ctx.success_rate == pytest.approx(2 / 3)


# ── EscalationPolicy Tests ──────────────────────────────────────────────────


class TestEscalationPolicy:
    def test_low_risk_auto_retry(self):
        level = EscalationPolicy.determine_level(0.3, 0.8)
        assert level == EscalationLevel.AUTO_RETRY

    def test_medium_risk_supervisor_review(self):
        level = EscalationPolicy.determine_level(0.6, 0.8)
        assert level == EscalationLevel.SUPERVISOR_REVIEW

    def test_high_risk_human_pager(self):
        level = EscalationPolicy.determine_level(0.85, 0.8)
        assert level == EscalationLevel.HUMAN_PAGER

    def test_critical_risk_incident_commander(self):
        level = EscalationPolicy.determine_level(0.96, 0.8)
        assert level == EscalationLevel.INCIDENT_COMMANDER

    def test_low_confidence_human_pager(self):
        level = EscalationPolicy.determine_level(0.5, 0.15)
        assert level == EscalationLevel.HUMAN_PAGER

    def test_destructive_high_risk_incident_commander(self):
        level = EscalationPolicy.determine_level(0.75, 0.8, is_destructive=True)
        assert level == EscalationLevel.INCIDENT_COMMANDER

    def test_should_page_human_retries_exhausted(self):
        assert EscalationPolicy.should_page_human(0.3, 0.8, retry_count=3, max_retries=3) is True

    def test_should_page_human_critical_risk(self):
        assert EscalationPolicy.should_page_human(0.96, 0.8, retry_count=0, max_retries=3) is True

    def test_should_page_human_low_confidence_with_retry(self):
        assert EscalationPolicy.should_page_human(0.5, 0.2, retry_count=1, max_retries=3) is True

    def test_should_not_page_human_normal(self):
        assert EscalationPolicy.should_page_human(0.3, 0.8, retry_count=0, max_retries=3) is False


# ── QualityGate Tests ───────────────────────────────────────────────────────


class TestQualityGate:
    def test_pass_normal_observation(self):
        obs = _make_obs(confidence=0.8, metadata={"risk_score": 0.5})
        result, reason = QualityGate.validate(obs)
        assert result == QualityGateResult.PASS

    def test_fail_low_confidence(self):
        obs = _make_obs(agent_id="DetectionAgent", confidence=0.3)
        result, reason = QualityGate.validate(obs)
        assert result == QualityGateResult.FAIL_CONFIDENCE
        assert "confidence" in reason

    def test_fail_missing_required_field(self):
        obs = _make_obs(agent_id="ForensicsAgent", confidence=0.8, metadata={})
        result, reason = QualityGate.validate(obs)
        assert result == QualityGateResult.FAIL_SCHEMA
        assert "root_cause" in reason

    def test_fail_agent_error(self):
        obs = _make_obs(confidence=0.8, error="API timeout")
        result, reason = QualityGate.validate(obs)
        assert result == QualityGateResult.FAIL_SAFETY

    def test_pass_response_agent_with_fields(self):
        obs = _make_obs(
            agent_id="ResponseAgent",
            confidence=0.95,
            metadata={"success": True, "action": "BLOCK_IP"},
        )
        result, reason = QualityGate.validate(obs)
        assert result == QualityGateResult.PASS

    def test_pass_compliance_agent_with_fields(self):
        obs = _make_obs(
            agent_id="ComplianceAgent",
            confidence=0.75,
            metadata={"mapped_controls": ["SOC2.CC6.1"]},
        )
        result, reason = QualityGate.validate(obs)
        assert result == QualityGateResult.PASS

    def test_different_agents_different_thresholds(self):
        obs_low = _make_obs(agent_id="DetectionAgent", confidence=0.55)
        obs_high = _make_obs(agent_id="ResponseAgent", confidence=0.55)
        r1, _ = QualityGate.validate(obs_low)
        r2, _ = QualityGate.validate(obs_high)
        assert r1 == QualityGateResult.PASS
        assert r2 == QualityGateResult.FAIL_CONFIDENCE


# ── SupervisorAgent Tool Tests ──────────────────────────────────────────────


class TestSupervisorAgentTools:
    @pytest.mark.asyncio
    async def test_quality_gate_tool_pass(self):
        agent = SupervisorAgent()
        obs = _make_obs(confidence=0.8, metadata={"risk_score": 0.5})
        result = await agent._tool_quality_gate(obs.model_dump())
        assert result["passed"] is True
        assert result["result"] == "pass"

    @pytest.mark.asyncio
    async def test_quality_gate_tool_fail(self):
        agent = SupervisorAgent()
        obs = _make_obs(agent_id="DetectionAgent", confidence=0.3)
        result = await agent._tool_quality_gate(obs.model_dump())
        assert result["passed"] is False
        assert result["result"] == "fail_confidence"

    @pytest.mark.asyncio
    async def test_escalation_policy_tool(self):
        agent = SupervisorAgent()
        result = await agent._tool_escalation_policy(0.3, 0.8, "DetectionAgent")
        assert result["level"] == "auto_retry"
        assert result["should_page_human"] is False

    @pytest.mark.asyncio
    async def test_escalation_policy_tool_critical(self):
        agent = SupervisorAgent()
        result = await agent._tool_escalation_policy(0.96, 0.8, "DetectionAgent")
        assert result["level"] == "incident_commander"
        assert result["should_page_human"] is True

    @pytest.mark.asyncio
    async def test_route_by_risk_low(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.3, False)
        assert result == "auto_approve"

    @pytest.mark.asyncio
    async def test_route_by_risk_high_unauthorized(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.85, False)
        assert result == "hitl"

    @pytest.mark.asyncio
    async def test_route_by_risk_high_authorized(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.85, True)
        assert result == "forensics"

    @pytest.mark.asyncio
    async def test_route_by_risk_very_high(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.96, False)
        assert result == "block"

    @pytest.mark.asyncio
    async def test_track_run_context(self):
        agent = SupervisorAgent()
        result = await agent._tool_track_run("inc-001", "detection", True)
        assert result is True
        ctx = agent.get_or_create_run_context("inc-001")
        assert "detection" in ctx.steps_completed


# ── SupervisorAgent RunContext Integration ───────────────────────────────────


class TestSupervisorRunContext:
    def test_get_or_create_run_context(self):
        agent = SupervisorAgent()
        ctx1 = agent.get_or_create_run_context("inc-001")
        ctx2 = agent.get_or_create_run_context("inc-001")
        assert ctx1 is ctx2
        assert ctx1.incident_id == "inc-001"

    def test_separate_incidents_get_separate_contexts(self):
        agent = SupervisorAgent()
        ctx1 = agent.get_or_create_run_context("inc-001")
        ctx2 = agent.get_or_create_run_context("inc-002")
        assert ctx1 is not ctx2


# ── Retry With Reflection Tests ─────────────────────────────────────────────


class TestRetryWithReflection:
    def test_build_reflection_prompt(self):
        agent = SupervisorAgent()
        obs = _make_obs(agent_id="DetectionAgent", confidence=0.3, tools=[])
        ctx = RunContext(incident_id="inc-001")
        prompt = agent._build_reflection_prompt(obs, ctx)
        assert "RETRY REFLECTION" in prompt
        assert "DetectionAgent" in prompt
        assert "attempt 1/3" in prompt
        assert "Low confidence" in prompt

    def test_build_reflection_prompt_with_error(self):
        agent = SupervisorAgent()
        obs = _make_obs(agent_id="ForensicsAgent", confidence=0.2, error="API timeout")
        ctx = RunContext(incident_id="inc-001")
        prompt = agent._build_reflection_prompt(obs, ctx)
        assert "API timeout" in prompt

    @pytest.mark.asyncio
    async def test_retry_with_no_factory_returns_none(self):
        agent = SupervisorAgent()
        obs = _make_obs(agent_id="UnknownAgent", confidence=0.3)
        ctx = RunContext(incident_id="inc-001")
        result = await agent.retry_with_reflection("UnknownAgent", obs, ctx)
        assert result is None

    @pytest.mark.asyncio
    async def test_retry_exhausted_returns_none(self):
        agent = SupervisorAgent()
        obs = _make_obs(agent_id="DetectionAgent", confidence=0.3)
        ctx = RunContext(incident_id="inc-001", max_retries=0)
        result = await agent.retry_with_reflection("DetectionAgent", obs, ctx)
        assert result is None


# ── MessageBus Tests ─────────────────────────────────────────────────────────


class TestMessageBus:
    def test_create_bus(self):
        bus = MessageBus()
        assert bus._subscribers == {}
        assert bus._history == []

    def test_subscribe(self):
        bus = MessageBus()
        handler = AsyncMock()
        bus.subscribe(AgentType.DETECTION, handler)
        assert handler in bus._subscribers[AgentType.DETECTION]

    @pytest.mark.asyncio
    async def test_publish_calls_handler(self):
        bus = MessageBus()
        handler = AsyncMock()
        bus.subscribe(AgentType.SUPERVISOR, handler)
        msg = AgentMessage(
            sender=AgentType.DETECTION,
            receiver=AgentType.SUPERVISOR,
            message_type=MessageType.ALERT,
            payload={"risk_score": 0.8},
        )
        await bus.publish(msg)
        handler.assert_called_once_with(msg)

    @pytest.mark.asyncio
    async def test_publish_stores_history(self):
        bus = MessageBus()
        msg = AgentMessage(
            sender=AgentType.DETECTION,
            receiver=AgentType.SUPERVISOR,
            message_type=MessageType.ALERT,
            payload={},
        )
        await bus.publish(msg)
        assert len(bus._history) == 1

    def test_get_history_filter_correlation(self):
        bus = MessageBus()
        import asyncio

        msg1 = AgentMessage(
            sender=AgentType.DETECTION,
            receiver=AgentType.SUPERVISOR,
            message_type=MessageType.ALERT,
            payload={},
            correlation_id="corr-1",
        )
        msg2 = AgentMessage(
            sender=AgentType.DETECTION,
            receiver=AgentType.SUPERVISOR,
            message_type=MessageType.ALERT,
            payload={},
            correlation_id="corr-2",
        )
        asyncio.get_event_loop().run_until_complete(bus.publish(msg1))
        asyncio.get_event_loop().run_until_complete(bus.publish(msg2))
        results = bus.get_history(correlation_id="corr-1")
        assert len(results) == 1


# ── AgentMessage Tests ──────────────────────────────────────────────────────


class TestAgentMessage:
    def test_create_message(self):
        msg = AgentMessage(
            sender=AgentType.DETECTION,
            receiver=AgentType.SUPERVISOR,
            message_type=MessageType.ALERT,
            payload={"risk_score": 0.8},
        )
        assert msg.sender == AgentType.DETECTION
        assert msg.receiver == AgentType.SUPERVISOR
        assert msg.priority == MessagePriority.NORMAL
        assert msg.message_id is not None
        assert msg.correlation_id is not None

    def test_create_reply(self):
        original = AgentMessage(
            sender=AgentType.DETECTION,
            receiver=AgentType.SUPERVISOR,
            message_type=MessageType.ALERT,
            payload={"risk_score": 0.8},
        )
        reply = original.create_reply(
            sender=AgentType.SUPERVISOR,
            message_type=MessageType.COMMAND,
            payload={"action": "investigate"},
        )
        assert reply.sender == AgentType.SUPERVISOR
        assert reply.receiver == AgentType.DETECTION
        assert reply.correlation_id == original.correlation_id
        assert reply.in_reply_to == original.message_id

    def test_message_priority_levels(self):
        for p in MessagePriority:
            msg = AgentMessage(
                sender=AgentType.SYSTEM,
                receiver=AgentType.SUPERVISOR,
                message_type=MessageType.LOG,
                payload={},
                priority=p,
            )
            assert msg.priority == p


# ── SupervisorAgent PRAO Lifecycle Tests ─────────────────────────────────────


class TestSupervisorPRAO:
    @pytest.mark.asyncio
    async def test_perceive_includes_run_context(self):
        agent = SupervisorAgent()
        state = _make_state(incident_id="inc-001", risk_score=0.6)
        perceived = await agent.perceive(state)
        assert "run_context" in perceived
        assert perceived["run_context"]["incident_id"] == "inc-001"

    @pytest.mark.asyncio
    async def test_reason_includes_escalation_and_quality(self):
        agent = SupervisorAgent()
        perceived = {
            "risk_score": 0.8,
            "is_authorized": False,
            "latest_observation": {"confidence_score": 0.5, "agent_id": "DetectionAgent"},
            "run_context": {"incident_id": "inc-001"},
        }
        calls = await agent.reason(_make_state(), perceived)
        tool_names = [c["tool"] for c in calls]
        assert "escalation_policy" in tool_names
        assert "quality_gate" in tool_names
        assert "route_by_risk" in tool_names

    @pytest.mark.asyncio
    async def test_observe_determines_quality_and_escalation(self):
        agent = SupervisorAgent()
        state = _make_state(risk_score=0.85, incident_id="inc-001")
        tool_results = [
            {"route": "hitl"},
            {"level": "human_pager", "should_page_human": True, "retry_count": 0, "max_retries": 3, "action": "page_on_call_analyst"},
            {"passed": True, "result": "pass", "reason": "ok"},
        ]
        obs = await agent.observe(state, tool_results, [{"tool": "route_by_risk"}, {"tool": "escalation_policy"}, {"tool": "quality_gate"}])
        assert obs.metadata["should_page_human"] is True
        assert obs.metadata["escalation_level"] == "human_pager"
        assert obs.next_state == ObservationNextState.ESCALATE

    @pytest.mark.asyncio
    async def test_observe_handles_quality_failure(self):
        agent = SupervisorAgent()
        state = _make_state(risk_score=0.5, incident_id="inc-001")
        tool_results = [
            {"route": "forensics"},
            {"level": "auto_retry", "should_page_human": False, "retry_count": 0, "max_retries": 3, "action": "retry_automatically"},
            {"passed": False, "result": "fail_confidence", "reason": "low"},
        ]
        obs = await agent.observe(state, tool_results, [{"tool": "route_by_risk"}, {"tool": "escalation_policy"}, {"tool": "quality_gate"}])
        assert obs.action_taken == "supervised_supervisor"
        assert obs.confidence_score == 0.5


# ── QualityGate Result Tests ────────────────────────────────────────────────


class TestQualityGateResult:
    def test_all_results_exist(self):
        assert QualityGateResult.PASS.value == "pass"
        assert QualityGateResult.FAIL_CONFIDENCE.value == "fail_confidence"
        assert QualityGateResult.FAIL_SCHEMA.value == "fail_schema"
        assert QualityGateResult.FAIL_SAFETY.value == "fail_safety"
        assert QualityGateResult.FAIL_TIMEOUT.value == "fail_timeout"
