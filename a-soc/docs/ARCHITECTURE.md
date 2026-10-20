# Architecture

This document describes A-SOC's system design, data flow, and failure modes. All diagrams use Mermaid and render on GitHub.

---

## System Overview

A-SOC is a multi-agent security operations platform. A central Supervisor agent orchestrates 6 specialist agents through a LangGraph state machine. Every agent follows the Perceive-Reason-Act-Observe (PRAO) lifecycle and emits structured `AgentObservation` objects.

```mermaid
graph TB
    subgraph "Cloud Sources"
        AWS["AWS CloudTrail<br/>GuardDuty, SecurityHub"]
        GCP["GCP Cloud Logging"]
        AZ["Azure Monitor"]
    end

    subgraph "Agent Pipeline"
        T["TelemetryAgent"]
        D["DetectionAgent"]
        S["SupervisorAgent"]
        F["ForensicsAgent"]
        R["ResponseAgent"]
        C["ComplianceAgent"]
        N["NotificationAgent"]
    end

    subgraph "External Systems"
        OPA["OPA Policy Engine"]
        LLM["LLM Provider<br/>OpenAI / Anthropic / Ollama"]
        PC["Pinecone<br/>Vector Store"]
    end

    subgraph "Data Stores"
        PG[("PostgreSQL<br/>Checkpointer + Events")]
        RD[("Redis<br/>Message Bus + Cache")]
    end

    subgraph "Human Gate"
        HITL["Approval Queue"]
        DASH["Dashboard<br/>WebSocket Feed"]
    end

    AWS --> T
    GCP --> T
    AZ --> T
    T --> D
    D --> S
    S -->|"risk < 0.5"| R
    S -->|"risk ≥ 0.8"| HITL
    S -->|"investigate"| F
    F --> R
    R --> C
    C --> N

    D -.->|"analyze"| LLM
    S -.->|"authorize"| OPA
    F -.->|"similarity"| PC
    S -.->|"checkpoint"| PG
    T -.->|"publish"| RD
    HITL -.->|"approve/deny"| DASH
```

---

## Agent Lifecycle (PRAO)

Every agent executes the same four-phase cycle:

```mermaid
sequenceDiagram
    participant State as AgentState
    participant Agent as Agent
    participant LLM as LLM Provider
    participant Tools as Tool Registry
    participant Obs as AgentObservation

    State->>Agent: run_cycle(state)
    Agent->>Agent: perceive(state) → perceived data
    Agent->>LLM: reason(state, perceived) → tool suggestions
    LLM-->>Agent: [{tool, args}, ...]
    Agent->>Agent: validate_tool_calls(suggested)
    Note over Agent: Rules reject unauthorized tools
    Agent->>Tools: act(validated_calls)
    Tools-->>Agent: [results]
    Agent->>Obs: observe(state, results) → AgentObservation
    Obs-->>State: updated state with observation
```

---

## Supervisor Agent Architecture

The Supervisor is the orchestrator. It doesn't just route — it validates quality, retries failed agents with reflection, and escalates when confidence is low.

```mermaid
flowchart TD
    IN[Agent Observation] --> QG{quality_gate}
    QG -->|"PASS"| ROUTE{route_by_risk}
    QG -->|"FAIL_CONFIDENCE"| RR[retry_with_reflection]
    QG -->|"FAIL_SAFETY"| ESC[escalation_policy]

    RR -->|retries < 3| AGENT[Re-run Agent<br/>with reflection prompt]
    RR -->|retries ≥ 3| ESC

    ROUTE -->|"risk < 0.5"| AUTO[Auto-approve]
    ROUTE -->|"0.5 ≤ risk < 0.8"| SUP[Supervisor review]
    ROUTE -->|"risk ≥ 0.8"| HITL[Human-in-the-loop]
    ROUTE -->|"risk ≥ 0.95"| BLOCK[Block action]

    ESC -->|"HUMAN_PAGER"| PAGE[Page on-call analyst]
    ESC -->|"INCIDENT_COMMANDER"| IC[Elevate to IC]

    AUTO --> RESP[ResponseAgent]
    SUP --> RESP
    HITL --> DASH[Dashboard Approval]
    DASH -->|"approved"| RESP
    DASH -->|"denied"| LOG[Log + Alert]

    style QG fill:#f59e0b,stroke:#f59e0b,color:#000
    style ESC fill:#ef4444,stroke:#ef4444,color:#fff
    style HITL fill:#ef4444,stroke:#ef4444,color:#fff
```

### Quality Gate Thresholds

| Agent | Min Confidence | Required Fields |
|-------|---------------|-----------------|
| DetectionAgent | 0.6 | `risk_score`, `reasoning` |
| ForensicsAgent | 0.5 | `root_cause`, `blast_radius` |
| ResponseAgent | 0.9 | `success`, `action` |
| ComplianceAgent | 0.7 | `mapped_controls` |
| TelemetryAgent | 0.7 | `event_count` |
| NotificationAgent | 0.8 | `sent_count` |
| SupervisorAgent | 0.8 | — |

### Escalation Levels

```mermaid
graph LR
    A["AUTO_RETRY<br/>risk < 0.5"] --> B["SUPERVISOR_REVIEW<br/>0.5 ≤ risk < 0.8"]
    B --> C["HUMAN_PAGER<br/>0.8 ≤ risk < 0.95"]
    C --> D["INCIDENT_COMMANDER<br/>risk ≥ 0.95 or destructive"]

    style A fill:#22c55e,color:#fff
    style B fill:#f59e0b,color:#000
    style C fill:#f97363,color:#fff
    style D fill:#ef4444,color:#fff
```

---

## Data Flow

```mermaid
flowchart LR
    subgraph "Ingestion"
        EV[Cloud Events] --> TA[TelemetryAgent]
        TA -->|normalize| NE[Normalized Events]
    end

    subgraph "Analysis"
        NE --> DA[DetectionAgent]
        DA -->|LLM + rules| DET{Threat?}
        DET -->|yes| RISK[Risk Score]
        DET -->|no| DISCARD[Discard]
    end

    subgraph "Supervision"
        RISK --> SA[SupervisorAgent]
        SA -->|OPA check| AUTH{Authorized?}
        AUTH -->|yes| RESP[ResponseAgent]
        AUTH -->|no| HITL[Human Approval]
    end

    subgraph "Investigation"
        RISK --> FA[ForensicsAgent]
        FA -->|blast radius| GRAPH[Attack Graph]
        FA -->|vector store| SIM[Similar Incidents]
    end

    subgraph "Remediation"
        RESP --> ACT[Execute Action]
        ACT --> VER[Verify Remediation]
        VER --> CA[ComplianceAgent]
        CA --> NA[NotificationAgent]
    end

    subgraph "Persistence"
        SA -.->|checkpoint| PG[("PostgreSQL")]
        TA -.->|events| RD[("Redis")]
        FA -.->|vectors| PC[("Pinecone")]
    end
```

---

## Checkpoint Strategy

A-SOC uses LangGraph's `AsyncPostgresSaver` for durable agent memory. If a worker crashes mid-incident, the pipeline resumes from the last checkpoint — not from zero.

```mermaid
sequenceDiagram
    participant W as Worker
    participant G as LangGraph
    participant PG as PostgreSQL

    W->>G: invoke(graph, state)
    G->>PG: checkpoint(state) after each node
    Note over G,PG: checkpoint after perceive, reason, act, observe

    W--xW: crash mid-pipeline

    W2->>G: invoke(graph, state, checkpoint_id)
    G->>PG: load last checkpoint
    PG-->>G: state restored
    G-->>W2: resume from last successful node
```

### Fallback

If PostgreSQL is unavailable, `MemorySaver` (in-memory) is used automatically. State is lost on restart but the system remains functional.

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| LLM API timeout | `async_retry` with 3 attempts | Falls back to `MockProvider` |
| OPA unreachable | HTTP error from `httpx` | Local policy rules apply |
| PostgreSQL down | Health check `pg_isready` | `MemorySaver` fallback |
| Redis down | `redis-cli ping` health check | Message bus unavailable; agents continue with local state |
| Agent quality gate fail | Confidence < threshold | `retry_with_reflection` (up to 3 attempts) |
| Worker crash | Docker restart policy | Resumes from last PostgreSQL checkpoint |
| High-risk action proposed | Escalation policy | Human-in-the-loop approval queue |

---

## Observability

```mermaid
graph LR
    API["FastAPI App"] -->|metrics| PROM["Prometheus"]
    API -->|traces| OTel["OTel Collector"]
    OTel -->|traces| JAEGER["Jaeger"]
    WORKER["Worker"] -->|metrics| PROM
    PROM -->|dashboards| GRAFANA["Grafana"]
    API -->|logs| LOKI["Loki"]
    LOKI -->|query| GRAFANA
```

- **Prometheus**: Request latency, error rates, circuit breaker states
- **Jaeger**: Distributed traces across agent pipeline
- **Grafana**: Pre-built dashboards for agent health, pipeline throughput
- **LangSmith**: LLM call tracing via `@traceable` decorators on all agent methods
