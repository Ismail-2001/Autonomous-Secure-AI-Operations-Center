# Agent Design

Every agent in A-SOC follows the **Perceive-Reason-Act-Observe (PRAO)** lifecycle. Each agent owns 2-7 tools, emits structured `AgentObservation` objects, and is governed by the Supervisor's quality gates.

---

## Lifecycle

```
perceive(state) → perceived data
  ↓
reason(state, perceived) → suggested tool calls [{tool, args}]
  ↓
validate_tool_calls(suggested) → approved calls (rules reject unauthorized)
  ↓
act(approved_calls) → tool results
  ↓
observe(state, results) → AgentObservation
  ↓
_apply_observation(state, observation) → updated state
```

**Base class:** `src/asoc/agents/base.py:BaseAgent`

---

## Agent Catalog

### 1. TelemetryAgent

**Role:** Ingest and normalize security events from cloud providers.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/telemetry.py` |
| Tools | `fetch_cloud_events`, `filter_events_by_risk`, `normalize_event_schema`, `emit_telemetry_alert` |
| Providers | `AWSCloudTrailProvider`, `GCPCloudProvider`, `AzureCloudProvider` |
| Quality Gate | Min confidence: 0.7, Required: `event_count` |
| Escalation | CONTINUE if events found, HALT if none |

**Decision Logic:**
1. Check provider health
2. Fetch cloud events (max 10)
3. Filter by risk heuristic (high-risk event names get 0.8 score)
4. Normalize to CloudEvent schema
5. Emit alert to message bus

**Failure Modes:**
- Provider unavailable → returns mock events (5 templates per provider)
- No events found → HALT, low confidence observation

---

### 2. DetectionAgent

**Role:** Analyze events for threats using LLM reasoning and rule-based scoring.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/detection.py` |
| Tools | `analyze_threat_llm`, `map_mitre_technique`, `query_risk_rules`, `calculate_risk_score` |
| LLM Provider | `LLMProvider` (OpenAI/Anthropic/DeepSeek/Mock) |
| Quality Gate | Min confidence: 0.6, Required: `risk_score`, `reasoning` |
| Escalation | ESCALATE if confidence < 0.7 or risk ≥ 0.8 |

**Decision Logic:**
1. Send event to LLM for threat analysis
2. Map to MITRE ATT&CK technique (rule-based first, LLM fallback)
3. Query OPA for risk thresholds
4. Combine LLM score + MITRE boost + event boost → final risk score

**Risk Score Formula:**
```
final_score = min(1.0, base_score + mitre_boost + event_boost)
mitre_boost = 0.1 if technique mapped
event_boost = 0.15 if event in high-risk set
```

**Failure Modes:**
- LLM timeout → falls back to `MockProvider`
- No MITRE match → no boost applied

---

### 3. SupervisorAgent

**Role:** Orchestrate the pipeline. Validate quality. Enforce policy. Escalate to humans.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/supervisor.py` |
| Tools | `query_opa_policy`, `quality_gate`, `retry_with_reflection`, `escalation_policy`, `route_by_risk`, `track_run_context`, `check_agent_health` |
| Quality Gate | Min confidence: 0.8 |
| Escalation | Routes based on risk score and confidence |

**Key Methods:**

#### `quality_gate(observation)`
Validates agent output against schema, confidence thresholds, and safety rules. Returns `QualityGateResult` (PASS, FAIL_CONFIDENCE, FAIL_SCHEMA, FAIL_SAFETY).

#### `retry_with_reflection(agent_name, original_obs, context)`
Re-runs a failed agent with an improved prompt. Builds a reflection prompt that includes:
- Failure analysis (low confidence, missing tools, errors)
- Retry-specific hints (attempt 1: try alternatives; attempt 2: focus on high-signal; attempt 3: best-effort with uncertainty markers)

#### `escalation_policy(risk_score, confidence, agent_name, is_destructive)`
Determines escalation level:

| Level | Condition | Action |
|-------|-----------|--------|
| AUTO_RETRY | risk < 0.5 | Retry automatically |
| SUPERVISOR_REVIEW | 0.5 ≤ risk < 0.8 | Supervisor reviews and routes |
| HUMAN_PAGER | 0.8 ≤ risk < 0.95 | Page on-call analyst |
| INCIDENT_COMMANDER | risk ≥ 0.95 or destructive + risk > 0.7 | Elevate to incident commander |

---

### 4. ForensicsAgent

**Role:** Investigate incidents. Build blast radius graphs. Find similar past incidents.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/forensics.py` |
| Tools | `search_similar_incidents`, `build_blast_radius_graph`, `reconstruct_timeline`, `store_incident_vector` |
| Vector Store | `vector_provider` (Pinecone or MockStore) |
| Quality Gate | Min confidence: 0.5, Required: `root_cause`, `blast_radius` |

**Decision Logic:**
1. Search vector store for similar past incidents (cosine similarity, top 3)
2. Build blast radius graph from incident data (nodes: IP, user, resources; edges: attack path)
3. Reconstruct chronological timeline from events
4. Store analysis to vector store for future similarity search

**Graph Construction:**
- **Source IP** → `threat_actor` node (critical risk)
- **Compromised user** → `identity` node (high risk)
- **Affected resources** → `resource` node (risk based on event type: Delete/Terminate = high, else medium)

---

### 5. ResponseAgent

**Role:** Execute approved remediation actions.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/response.py` |
| Tools | `block_ip_address`, `revoke_iam_access`, `isolate_instance`, `quarantine_s3_bucket`, `verify_remediation` |
| Provider | `RemediationProvider` (MockRemediationProvider or AWSRemediationProvider) |
| Quality Gate | Min confidence: 0.9, Required: `success`, `action` |
| Risk Level | ALL tools marked `is_high_risk=True`, `requires_authorization=True` |

**Plugin Architecture:**
```python
class RemediationProvider(ABC):
    async def block_ip(ip, reason) -> bool
    async def revoke_iam_access(user, reason) -> bool
    async def isolate_instance(instance_id, reason) -> bool
    async def quarantine_s3_bucket(bucket_name, reason) -> bool
    async def verify_remediation(action_type, target) -> bool
```

- `MockRemediationProvider`: Always returns `True`. Used in dev/testing.
- `AWSRemediationProvider`: Real boto3 calls. Used in production.

**Safety:** Every tool requires authorization. The agent will not execute if `is_authorized` is `False` in state.

---

### 6. ComplianceAgent

**Role:** Map incidents to compliance frameworks. Generate audit reports.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/compliance.py` |
| Tools | `map_to_frameworks`, `check_control_status`, `generate_compliance_report` |
| Quality Gate | Min confidence: 0.7, Required: `mapped_controls` |
| Frameworks | SOC 2, ISO 27001, HIPAA, NIST, GDPR |

**Framework Mapping:**
```python
FRAMEWORK_MAPPINGS = {
    "revoked_access":       ["SOC2.CC6.1", "ISO.A.9.2.6", "NIST.AC-6"],
    "unauthorized_login":   ["SOC2.CC6.8", "NIST.AC-2", "HIPAA.164.312.d"],
    "data_exfiltration":    ["GDPR.Art.33", "HIPAA.164.308", "SOC2.CC6.7"],
    "privilege_escalation": ["SOC2.CC6.1", "NIST.AC-6.1", "ISO.A.9.2.3"],
    "brute_force":          ["NIST.AC-7", "SOC2.CC6.1", "ISO.A.9.4.3"],
}
```

---

### 7. NotificationAgent

**Role:** Send alerts via configured channels.

| Property | Value |
|----------|-------|
| File | `src/asoc/agents/notifications.py` |
| Tools | `send_slack_alert`, `send_teams_alert`, `create_jira_ticket`, `format_alert_message` |
| Providers | `SlackWebhookProvider`, `TeamsWebhookProvider`, `JiraProvider` |
| Quality Gate | Min confidence: 0.8, Required: `sent_count` |

**Provider Selection:** Auto-configured from environment variables:
- `SLACK_WEBHOOK_URL` → Slack provider
- `TEAMS_WEBHOOK_URL` → Teams provider
- `JIRA_URL` + `JIRA_EMAIL` + `JIRA_API_TOKEN` + `JIRA_PROJECT_KEY` → JIRA provider

---

## Inter-Agent Communication

Agents communicate through the `MessageBus` (Redis-backed) using typed `AgentMessage` objects.

```python
class AgentMessage:
    message_id: str
    message_type: MessageType  # alert, command, report, response, log
    source: AgentType
    target: AgentType | None
    priority: MessagePriority  # low, medium, high, critical
    payload: dict
    correlation_id: str | None  # links messages in same incident
```

**No direct agent-to-agent calls.** All communication goes through the bus. This ensures:
- Auditability (every message is logged)
- Decoupling (agents can be scaled independently)
- Replays (messages can be reprocessed for debugging)

---

## Testing Strategy

| Test Type | Count | What It Tests |
|-----------|-------|---------------|
| Agent unit tests | 55 | Each agent's PRAO lifecycle with mock tools |
| Graph integration tests | 22 | LangGraph routing, conditional edges, checkpointing |
| Supervisor tests | 45 | Quality gate, retry-with-reflection, escalation, RunContext |
| E2E tests | 5 | Full pipeline, OPA block, checkpoint resume, rate limit, WebSocket |
| Performance tests | 3 scenarios | Locust load tests (health, hunting, pipeline) |

All agent tests use `MockProvider` for LLM calls, ensuring deterministic results.
