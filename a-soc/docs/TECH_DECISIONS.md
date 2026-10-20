# Architecture Decision Records

This document records the key architectural decisions made in A-SOC. Each decision includes context, options considered, rationale, and consequences.

---

## ADR-001: LangGraph over CrewAI for Agent Orchestration

**Status:** Accepted

**Context:** We needed an orchestration framework for a 7-agent pipeline with checkpointing, conditional routing, and human-in-the-loop support.

**Options:**
1. **LangGraph** — State machine with explicit nodes, edges, and checkpointing
2. **CrewAI** — Task-based orchestration with implicit agent delegation
3. **Custom** — Hand-rolled asyncio orchestration

**Decision:** LangGraph

**Rationale:**
- **Explicit state machine**: Every node transition is defined in code. No implicit delegation or "magic" routing.
- **Checkpointing**: Built-in `AsyncPostgresSaver` enables resume-from-crash without custom state serialization.
- **Conditional edges**: Risk-based routing (auto-approve vs. HITL) is a first-class concept.
- **Observability**: Each node execution is traceable via LangSmith.
- **Ecosystem**: LangChain integration means we can swap LLM providers without changing agent code.

**Consequences:**
- Steeper learning curve than CrewAI (explicit graph definition)
- Requires understanding of TypedDict state schemas
- More code than CrewAI for simple pipelines, but essential for our complexity level

---

## ADR-002: OPA for Policy Enforcement

**Status:** Accepted

**Context:** High-risk actions (IAM revocation, instance isolation) must be authorized by policy before execution. Policy must be auditable and version-controlled.

**Options:**
1. **OPA (Open Policy Agent)** — Rego policy language, REST API, GitOps-compatible
2. **Hardcoded rules** — `if risk > 0.8: block` in Python
3. **Custom policy engine** — Build our own

**Decision:** OPA

**Rationale:**
- **Auditable**: Rego policies are plain text, reviewable in PRs, stored in Git
- **Separation of concerns**: Policy lives outside application code. Security teams can update rules without touching Python.
- **GitOps-compatible**: Policy changes go through the same CI/CD as code changes
- **Industry standard**: Used by Kubernetes (Gatekeeper), Terraform, and major enterprises
- **Fallback**: If OPA is unreachable, local Python rules apply (less auditable but functional)

**Consequences:**
- Adds a dependency (OPA container in Docker Compose)
- Rego has a learning curve for Python developers
- Requires running OPA as a sidecar or service

---

## ADR-003: HMAC Audit Trail for Compliance

**Status:** Accepted

**Context:** SOC 2 and ISO 27001 require tamper-evident audit logs. Every agent action and LLM reasoning chain must be cryptographically signed.

**Options:**
1. **HMAC signatures** — Hash-based Message Authentication Code with shared secret
2. **Digital signatures** — RSA/ECDSA with key pairs
3. **Append-only log** — Database-level immutability without cryptographic signing

**Decision:** HMAC

**Rationale:**
- **Simplicity**: HMAC is trivial to implement and verify
- **Performance**: No asymmetric cryptography overhead
- **Sufficient for compliance**: SOC 2 requires tamper-evidence, not non-repudiation. HMAC provides the former.
- **Secret rotation**: HMAC_SECRET can be rotated without changing the signing algorithm

**Consequences:**
- Shared secret (HMAC_SECRET) must be securely stored
- Does not provide non-repudiation (anyone with the secret can sign)
- Acceptable because the audit log is internal, not shared with third parties

---

## ADR-004: Hybrid LLM + Rule-Based Tool Selection

**Status:** Accepted

**Context:** LLMs can hallucinate tool calls. We need a way to prevent agents from invoking unauthorized or dangerous tools.

**Options:**
1. **Hybrid** — LLM suggests tools, rules validate/approve
2. **Pure LLM** — Trust the LLM to choose correct tools
3. **Pure rules** — No LLM in tool selection, only rule-based

**Decision:** Hybrid

**Rationale:**
- **LLM strength**: Contextual reasoning, understanding ambiguous events
- **Rule strength**: Deterministic validation, rate limiting, authorization checks
- **Defense in depth**: Even if the LLM hallucinates a dangerous tool call, the rule layer blocks it

**Implementation:**
```python
# LLM suggests
suggested_calls = await self.reason(state, perceived)

# Rules validate
validated_calls = self._validate_tool_calls(suggested_calls, state)

# Only validated calls execute
tool_results = await self.act(validated_calls, state)
```

**Consequences:**
- Adds a validation layer (negligible performance cost)
- Rules must be maintained separately from LLM prompts
- New tools require both LLM prompt updates AND rule updates

---

## ADR-005: PostgreSQL Checkpointer over Redis

**Status:** Accepted

**Context:** Agent state must survive worker crashes. We need durable checkpointing for the LangGraph pipeline.

**Options:**
1. **PostgreSQL** — `AsyncPostgresSaver` with ACID transactions
2. **Redis** — Fast but volatile (default AOF can lose data)
3. **File system** — JSON files on disk
4. **Memory only** — No persistence

**Decision:** PostgreSQL (with MemorySaver fallback)

**Rationale:**
- **Durability**: PostgreSQL guarantees ACID. Checkpoints are not lost on crash.
- **Existing dependency**: PostgreSQL is already required for the event store
- **Query capability**: Can query checkpoint history for debugging
- **MemorySaver fallback**: If PostgreSQL is unavailable, the system degrades gracefully

**Consequences:**
- Checkpoint writes add ~12ms latency per node
- PostgreSQL must be highly available for production
- MemorySaver fallback means state loss on restart (acceptable for dev/testing)

---

## ADR-006: Plugin Architecture for ResponseAgent

**Status:** Accepted

**Context:** The ResponseAgent executes remediations. Different environments need different providers (mock for dev, AWS for prod).

**Options:**
1. **Plugin (Strategy pattern)** — `RemediationProvider` ABC with multiple implementations
2. **Environment flags** — `if ENV == "prod": use_aws() else: use_mock()`
3. **Separate agents** — `MockResponseAgent` and `AWSResponseAgent`

**Decision:** Plugin (Strategy pattern)

**Rationale:**
- **Testability**: Mock provider enables deterministic E2E tests
- **Extensibility**: Adding GCP/Azure remediation is a new class, not modified code
- **Single responsibility**: ResponseAgent handles orchestration; provider handles execution

**Implementation:**
```python
class ResponseAgent(BaseAgent):
    def __init__(self, provider: RemediationProvider | None = None):
        self.provider = provider or MockRemediationProvider()
```

**Consequences:**
- Provider selection is at construction time (not runtime)
- New providers must implement the full `RemediationProvider` interface
- AWS provider adds boto3 dependency (~15MB)

---

## ADR-007: D3.js over React Flow for Blast Radius

**Status:** Accepted

**Context:** The blast radius visualization must show interactive attack graphs with animated threat propagation.

**Options:**
1. **D3.js** — Low-level SVG manipulation with force simulation
2. **React Flow** — Higher-level React component for node-based graphs
3. **Recharts** — Charting library (not designed for graphs)

**Decision:** D3.js

**Rationale:**
- **Physics simulation**: D3-force provides realistic node layout. React Flow uses static positions.
- **Animated threat propagation**: D3's dashed line animation shows threat flow direction. React Flow edges are static.
- **Custom interaction**: Click-to-highlight-downstream requires graph traversal and opacity control. D3 gives direct DOM access.
- **No React re-rendering**: D3 manages its own SVG, avoiding reconciliation overhead for 60fps animations.

**Consequences:**
- Lower-level API requires more code (~400 lines vs ~50 for React Flow)
- D3 elements are outside React's virtual DOM (testing requires different approach)
- Encapsulated in `BlastRadiusGraph.tsx` — rest of app only interacts via `data` prop

---

## ADR-008: Native WebSocket over Socket.io

**Status:** Accepted

**Context:** The dashboard needs real-time threat feed updates via WebSocket.

**Options:**
1. **Native WebSocket** — Browser API with custom reconnection
2. **Socket.io** — Library with automatic reconnection and fallback

**Decision:** Native WebSocket

**Rationale:**
- **No dependency**: Socket.io adds ~50KB gzipped
- **Predictable behavior**: No Engine.IO protocol layer complicating debugging
- **Explicit state machine**: `CONNECTING → OPEN → RECONNECTING → CLOSED` is testable
- **Message queue**: Custom offline buffer gives full control over retry semantics

**Consequences:**
- No HTTP long-polling fallback (WebSocket support is >98% globally)
- Reconnection logic must be implemented manually (done in `useThreatFeed` hook)
- Socket.io can be added as drop-in replacement if needed

---

## ADR-009: Per-Agent Tool Registry with Validation

**Status:** Accepted

**Context:** Agents need to invoke tools, but tool calls must be validated for authorization and rate limiting.

**Options:**
1. **ToolRegistry** — Central registry with validation
2. **Direct method calls** — `self.fetch_events()` instead of registry
3. **External tool server** — MCP-style tool execution

**Decision:** ToolRegistry

**Rationale:**
- **Uniform interface**: All tools registered with schema, description, risk level
- **Validation layer**: `validate_tool_call()` checks authorization, rate limits, tool existence
- **LangChain compatibility**: `get_langchain_tools()` converts registry to LangChain format
- **Discoverability**: `list_tool_names()` enables runtime tool enumeration

**Implementation:**
```python
registry.register(
    name="block_ip_address",
    func=self._tool_block_ip,
    description="Block a malicious IP via security groups",
    is_high_risk=True,
    requires_authorization=True,
)
```

**Consequences:**
- Every tool must be explicitly registered (no auto-discovery)
- Tool schemas are maintained in code (not auto-generated from function signatures)
- Registry is per-agent (not shared across agents)

---

## ADR-010: Frontend Version Choices (Canary/RC/Alpha)

**Status:** Accepted

**Context:** The dashboard uses cutting-edge frontend versions. This decision documents why.

**See:** [dashboard/TECH_DECISIONS.md](../dashboard/TECH_DECISIONS.md) for full rationale.

**Summary:**
- Next.js 15.x Canary: RSC improvements, standalone Docker optimization
- React 19 RC: `use()` hook, `useOptimistic`, form Actions
- Tailwind CSS v4 alpha: Oxide engine (Rust-based, 10x faster builds)

**Tradeoff:** These are not stable releases. The risk is acceptable because:
1. This is an internal security dashboard, not a public-facing site
2. Exact versions are pinned in `package.json`
3. Fallback to stable versions is documented and straightforward
