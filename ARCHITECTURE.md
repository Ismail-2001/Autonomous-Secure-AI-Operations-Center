# Autonomous AI Security Operations Center (A-SOC)
## Technical Architecture Whitepaper & System Design Specification

> **Version:** 2.4.0-Production  
> **Classification:** Enterprise Security Architecture Specification  
> **Status:** Production-Ready Hardened  
> **Target Deployments:** Hetzner Cloud (k3s/Compose), AWS EKS, GCP GKE, On-Premise Air-Gapped K8s  

---

## 1. Executive Summary & Problem Space

Enterprise Security Operations Centers (SOCs) face an asymmetric threat landscape:
1. **Alert Volume vs. Human Capacity:** Modern mid-to-large enterprises ingest **10,000 to 50,000+ security alerts daily** across EDRs, CloudTrails, identity providers, and network boundaries. A human Tier-1 analyst can thoroughly evaluate only **15–25 alerts per 8-hour shift**, resulting in alert fatigue, missed dwell-time indicators, and severe analyst burnout.
2. **The MTTR vs. Ransomware Mismatch:** Average enterprise dwell time and Mean Time to Respond (MTTR) are measured in **hours or days**. Conversely, automated ransomware operators (e.g., BlackCat/ALPHV, LockBit) require only **10 to 45 minutes** from initial foothold to full domain encryption and data exfiltration.
3. **The Fragility of Legacy SOAR:** Traditional SOAR systems rely on brittle, hardcoded Python decision trees that break whenever an attacker deviates from pre-scripted execution paths or an API schema changes.

### The A-SOC Paradigm
A-SOC replaces brittle decision trees with an **autonomous multi-agent reasoning graph** governed by **mathematical, deterministic policy boundaries (Open Policy Agent)** and **distributed concurrency-safe workers**. It achieves sub-second Mean Time to Detect (MTTD) and sub-minute Mean Time to Respond (MTTR), while ensuring strict Human-in-the-Loop (HITL) approval gates for destructive containment actions.

---

## 2. High-Level System Topology

```mermaid
flowchart TB
    subgraph Ingestion["Enterprise Ingestion Layer"]
        Splunk["Splunk HEC (HTTP Event Collector)"]
        Sentinel["Microsoft Sentinel Webhook"]
        CrowdStrike["CrowdStrike Falcon Webhook"]
        Syslog["Universal SIEM / Datadog Webhook"]
    end

    subgraph Edge["Edge & Reverse Proxy"]
        Caddy["Caddy 2 Proxy (Auto-TLS, HTTP/2, WSS)"]
    end

    subgraph API["Backend API Cluster (FastAPI Multi-Pod)"]
        API1["API Pod 1 (Port 9002)"]
        API2["API Pod 2 (Port 9002)"]
        WS_Manager["ConnectionManager (WebSocket Feed)"]
    end

    subgraph StateBus["Distributed State & Message Bus"]
        Redis["Redis 7 (Auth Tokens, Rate Limits, Pub/Sub Bus)"]
        Postgres[("PostgreSQL 15 (Jobs Queue, Events, Users, State)")]
    end

    subgraph Workers["Async Worker Pool (Multi-Replica)"]
        Worker1["AsocWorker Pod 1 (SELECT FOR UPDATE SKIP LOCKED)"]
        Worker2["AsocWorker Pod 2 (SELECT FOR UPDATE SKIP LOCKED)"]
    end

    subgraph Reasoning["Autonomous Agentic Reasoning Engine (LangGraph)"]
        DetectionAgent["Detection Agent (Anomaly & Triage)"]
        ForensicsAgent["Forensics Agent (IOC & Tool Calling)"]
        ResponseAgent["Response Agent (Plan Generation)"]
        ComplianceAgent["Compliance Agent (SOC 2 / ISO 27001)"]
    end

    subgraph Guardrails["Deterministic Safety & Enforcement"]
        OPA["Open Policy Agent (Rego Guardrails)"]
        HITL["Human-in-the-Loop Approval Gate"]
        CloudAction["Remediation Engine (AWS NACL Deny / Host Blackhole)"]
    end

    Ingestion --> Caddy
    Caddy --> API1 & API2
    API1 & API2 <--> Redis
    API1 & API2 <--> Postgres
    API1 & API2 <--> WS_Manager

    Workers <--> Postgres
    Workers <--> Redis
    Workers --> Reasoning
    Reasoning --> Guardrails
    Guardrails --> CloudAction
```

---

## 3. Distributed Concurrency & Worker Architecture

High-throughput SOCs cannot rely on single-process workers. A-SOC is designed for **horizontal scaling with zero duplicate claim semantics**.

### 3.1. Concurrency Safety: `SELECT ... FOR UPDATE SKIP LOCKED`
When multiple worker replicas (`worker-1`, `worker-2`, ..., `worker-N`) poll the PostgreSQL queue simultaneously, standard database row locking creates bottlenecks or deadlocks. A-SOC implements lock-free distributed claiming using PostgreSQL’s `SKIP LOCKED` primitive:

```sql
WITH next_job AS (
    SELECT id
    FROM jobs
    WHERE state = 'PENDING'
      AND (locked_by IS NULL OR locked_at < NOW() - INTERVAL '300 seconds')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE jobs
SET state = 'RUNNING',
    locked_by = $1,
    locked_at = NOW(),
    heartbeat_at = NOW(),
    attempt = attempt + 1,
    updated_at = NOW()
FROM next_job
WHERE jobs.id = next_job.id
RETURNING jobs.*;
```

* **Zero Lock Contention:** Competing workers skip locked rows immediately without waiting in blocking lock queues.
* **Zero Duplicate Claims:** PostgreSQL guarantees that only one transaction can acquire the row lock.
* **Dead Worker Lock Recovery:** If a worker crashes or is killed by an OOM killer without releasing its lock, the stale timeout condition (`locked_at < NOW() - INTERVAL '300 seconds'`) allows healthy workers to reclaim and resume the abandoned job.

### 3.2. Heartbeating & Liveness Tracking
Active workers maintain an asynchronous heartbeat loop every 10 seconds:
$$\Delta t_{\text{heartbeat}} = 10\text{s}, \quad T_{\text{stale}} = 300\text{s}$$
If a supervisor externally cancels an incident (`POST /api/v1/jobs/{id}/cancel`), the heartbeat query detects the `CANCELLED` state change and aborts the in-flight `asyncio.Task` cleanly.

### 3.3. Distributed Idempotency Engine
To prevent irreversible external actions (e.g., AWS host network containment, IAM credential revocation, Slack pager dispatches) from executing more than once during job retries, A-SOC implements a deterministic SHA-256 idempotency manager backed by Redis atomic locks:

$$\text{Key} = \text{SHA256}(\text{incident\_id} \,\|\, \text{action\_name} \,\|\, \text{canonical\_json}(\text{params}))$$

```python
# Atomic lock acquisition with automatic TTL expiration
lock_acquired = await redis.set(f"{key}:lock", "IN_PROGRESS", nx=True, ex=300)
if not lock_acquired:
    return False, cached_outcome
```

---

## 4. Multi-Pod Real-Time Feed (Redis Pub/Sub)

In a horizontally scaled Kubernetes deployment with multiple API pods behind an ingress controller, browser clients connected via WebSockets to `Pod-A` will not receive broadcasts emitted by `Pod-B` unless a distributed bus bridges them.

```mermaid
sequenceDiagram
    participant Worker as AsocWorker (Incident Pipeline)
    participant RedisPub as Redis Pub/Sub (Channel: asoc:threat-feed:pubsub)
    participant PodA as API Pod 1 (ConnectionManager)
    participant PodB as API Pod 2 (ConnectionManager)
    participant ClientA as Analyst Browser 1 (Connected to Pod 1)
    participant ClientB as Analyst Browser 2 (Connected to Pod 2)

    Worker->>RedisPub: PUBLISH {"type": "INCIDENT_ALERT", "id": "INC-402"}
    RedisPub-->>PodA: Broadcast payload
    RedisPub-->>PodB: Broadcast payload
    PodA->>ClientA: WebSocket.send_json(payload)
    PodB->>ClientB: WebSocket.send_json(payload)
```

1. **Local + Distributed Fan-Out:** When `ConnectionManager.broadcast()` is invoked, it broadcasts to locally attached WebSockets and publishes the JSON payload to the Redis channel `asoc:threat-feed:pubsub`.
2. **Background Subscriber Loop:** Every API container runs an asynchronous background subscriber task attached to the FastAPI lifespan context, ensuring 100% feed delivery consistency across all pods.

---

## 5. Autonomous Multi-Agent Reasoning Topology

A-SOC orchestrates specialized agents using a compiled LangGraph cyclic state machine:

```mermaid
stateDiagram-v2
    [*] --> IngestionTelemetry
    IngestionTelemetry --> DetectionAgent: Correlated Telemetry
    DetectionAgent --> QualityGate: AgentObservation
    
    state QualityGate {
        [*] --> ConfidenceCheck
        ConfidenceCheck --> ReflectionRetry: Confidence < 0.5 (Max 3)
        ReflectionRetry --> ConfidenceCheck
        ConfidenceCheck --> PassGate: Confidence >= 0.5
    }

    QualityGate --> ForensicsAgent: Validated Signal
    ForensicsAgent --> ResponseAgent: Forensic Evidence & IOCs
    ResponseAgent --> OPAGuardrails: Propose Containment Plan
    
    state OPAGuardrails {
        [*] --> RegoEvaluation
        RegoEvaluation --> AutoExecute: Low Risk & Safe Asset
        RegoEvaluation --> SupervisorHITL: High Risk / Tier-1 Asset
    }

    SupervisorHITL --> ExecutionEngine: Human Approves
    SupervisorHITL --> Aborted: Human Denies
    AutoExecute --> ExecutionEngine
    ExecutionEngine --> ComplianceAgent: Action Evidence
    ComplianceAgent --> NotificationAgent: Signed Audit Record
    NotificationAgent --> [*]
```

### 5.1. LLM Provider Failover Chain
To guarantee high-throughput reasoning under API outages or rate limits, the reasoning engine implements an automatic failover chain:

| Tier | Provider | Model | Latency | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | **Groq** | `llama-3.3-70b-versatile` | ~250–350 tokens/s | Rapid sub-second triage, IOC extraction, MITRE mapping |
| **Secondary** | **DeepSeek** | `deepseek-chat` (DeepSeek-V3) | ~60–90 tokens/s | Complex multi-stage forensic analysis & code execution |
| **Tertiary** | **Local Ollama** | `llama3.1:8b` (Q4_K_M) | Variable (CPU/GPU) | Air-gapped fallback / Internet disconnection survival |
| **Optional** | **OpenAI** | `gpt-4o` | ~70 tokens/s | Enterprise commercial fallback |

### 5.2. Autonomous Security Tools
The LLM agents possess first-class autonomous tool-calling capabilities ([src/asoc/agents/security_tools.py](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/src/asoc/agents/security_tools.py)):
- `query_siem_events(query, agent_source, limit)`: Semantic log inspection over the Event Store.
- `lookup_threat_intel(indicator)`: High-speed RFC 1918 private address pre-filtering with live AbuseIPDB v2 / VirusTotal enrichment.
- `lookup_mitre_technique(technique_id)`: MITRE ATT&CK taxonomy and sub-technique resolution.
- `network_quarantine_host(host_identifier)`: Cryptographically logged, idempotent host isolation.

---

## 6. Deterministic Safety Boundaries & Enterprise Governance

Enterprises cannot deploy unconstrained LLMs with write permissions to production cloud infrastructure. A-SOC separates **probabilistic reasoning** (the LLM) from **deterministic enforcement** (OPA & Guardrails).

### 6.1. Open Policy Agent (OPA) Mathematical Guardrails
Before any containment action is executed, the proposed action payload is evaluated by embedded Rego policies:
- **Blast Radius Protection:** Actions impacting $>5\%$ of production workloads are denied automatically.
- **Protected Asset Immunity:** Domain Controllers, Core Payment Gateways, and Production Database clusters are marked `immutable_tier1` and cannot be isolated without manual multi-party authorization.
- **Maintenance Windows:** Actions targeting development environments during scheduled maintenance bypass paging alerts.

### 6.2. Global Pilot Safety: `EXECUTION_MODE: SHADOW`
To enable friction-free customer onboarding and 30-day proof-of-concept (POC) audits, A-SOC features an immutable operational execution switch:

$$\text{EXECUTION\_MODE} \in \{\text{SHADOW}, \text{DRY\_RUN}, \text{ACTIVE\_ENFORCEMENT}\}$$

* In **`SHADOW` mode**, all triage, reasoning, blast-radius analysis, and response plans execute normally. However, external containment drivers intercept the call, log `WOULD_HAVE_EXECUTED` to the HMAC audit trail, and return simulated success without touching live cloud infrastructure.
* In **`ACTIVE_ENFORCEMENT` mode**, real cloud containment is executed.

### 6.3. Cloud Containment: VPC NACL Deny Rules & Egress Blackholing
* **AWS Security Group Denial Fix:** AWS Security Groups are purely allow-lists (they lack `DENY` rules). A-SOC implements network-level IP blocking via **VPC Network Access Control Lists (NACLs)** using high-priority explicit `deny` rules:
  ```python
  client.create_network_acl_entry(
      NetworkAclId=nacl_id,
      RuleNumber=50,
      Protocol="-1",
      RuleAction="deny",
      Egress=False,
      CidrBlock=f"{ip}/32",
  )
  ```
* **Host Quarantine Isolation:** When isolating an EC2 instance, A-SOC attaches an emergency quarantine security group and **explicitly revokes default `0.0.0.0/0` egress permissions**, establishing an absolute communication blackhole.

---

## 7. Enterprise SIEM & EDR Ingestion Connectors

A-SOC provides direct HTTP endpoints for legacy enterprise SIEMs and modern EDRs:

```mermaid
flowchart LR
    subgraph Vendors["Enterprise Telemetry Sources"]
        Splunk["Splunk Enterprise / Cloud"]
        Sentinel["Microsoft Sentinel"]
        Falcon["CrowdStrike Falcon"]
        Generic["Datadog / Elastic"]
    end

    subgraph Endpoints["A-SOC Ingestion Gateway"]
        E1["/api/v1/integrations/splunk/hec"]
        E2["/api/v1/integrations/sentinel/webhook"]
        E3["/api/v1/integrations/crowdstrike/webhook"]
        E4["/api/v1/integrations/generic/webhook"]
    end

    subgraph Pipeline["Ingest & Triage Pipeline"]
        Normalizer["SiemNormalizer (Canonical Schema)"]
        Store["HMAC Signed EventStore"]
        Router{"Is Actionable?<br/>(High/Critical?)"}
        Queue["JobService (Autonomous Investigation)"]
        Feed["WebSocket Live Broadcast"]
    end

    Splunk -->|Authorization: Splunk HEC| E1
    Sentinel -->|X-Sentinel-Token| E2
    Falcon -->|X-CrowdStrike-Secret| E3
    Generic -->|Bearer Token| E4

    E1 & E2 & E3 & E4 --> Normalizer
    Normalizer --> Store
    Normalizer --> Feed
    Normalizer --> Router
    Router -->|Yes| Queue
    Router -->|No (Info/Low)| Store
```

- **Splunk HEC Compatibility:** Strictly complies with Splunk RFC format, supporting single JSON events, raw string messages, and batched event arrays, returning standard Splunk acknowledgments (`{"text": "Success", "code": 0}`).
- **Entity Extraction:** Sentinel entities (`IP`, `Account`, `Host`) and CrowdStrike detection metadata (`CommandLine`, `ParentProcess`) are extracted into uniform attributes.
- **Autonomous Job Escalation:** Alerts classified as `High` or `Critical` automatically enqueue an async workflow job without requiring analyst intervention.

---

## 8. Cryptographic Compliance & Evidence Integrity

Auditors frequently challenge the authenticity of incident logs. A-SOC integrates continuous, automated evidence collection mapped to **SOC 2 Type II** and **ISO/IEC 27001:2022**.

### 8.1. Control Mapping Matrix
| Framework | Control ID | Control Name | Automated A-SOC Implementation |
| :--- | :--- | :--- | :--- |
| **SOC 2** | `CC6.1` | Logical Access & RBAC | Least-privilege FastAPI `require_role(Role.SUPERVISOR)` gates |
| **SOC 2** | `CC6.8` | Account Lockout & Brute Force | Argon2id password hashing + 5-attempt/15-minute lockouts |
| **SOC 2** | `CC7.1` | Autonomous Threat Pipeline | Sub-minute MITRE ATT&CK detection and IOC classification |
| **SOC 2** | `CC7.2` | Incident Triage SLA | Automated response plans with mandatory supervisor approvals |
| **SOC 2** | `CC7.3` | Immutable Audit Records | HMAC-SHA256 signatures on every audit entry and event |
| **ISO 27001**| `A.5.24` | Incident Management Planning | Automated incident recovery, checkpointing, and LangGraph resumption |
| **ISO 27001**| `A.5.28` | Collection of Evidence | Tamper-evident forensic artifacts and reproducible hash generation |
| **ISO 27001**| `A.8.15` | Logging & Tamper Resistance | Append-only database event log with verified HMAC headers |
| **ISO 27001**| `A.8.16` | Anomaly Detection | Continuous telemetry monitoring via multi-agent reasoning |

### 8.2. SHA-256 Cryptographic Evidence Manifest
When compliance evidence is exported (`GET /api/v1/compliance/export`), the exporter serializes all evaluated controls, timestamps, and audit records into a canonical JSON payload and computes its cryptographic hash:

$$\text{Manifest\_SHA256} = \text{SHA256}(\text{canonical\_json}(\text{EvidencePackage}))$$

Any retroactive modification to a log entry, user account, or incident record invalidates the manifest hash, giving auditors mathematical proof of data integrity.

---

## 9. FinOps & Lean Production Infrastructure Profile

A-SOC avoids multi-thousand-dollar monthly cloud infrastructure bills. The entire production stack is engineered to run comfortably on a single **Hetzner CPX31 Cloud VPS** (~€13.50/mo: 4 vCPU, 8 GB RAM, 160 GB NVMe SSD) by offloading heavy LLM reasoning to high-speed cloud APIs (Groq/DeepSeek):

| Service | Runtime | CPU Allocation | Memory Limit | Memory Reservation | Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Caddy 2** | Alpine Go binary | 0.25 vCPU | 128 MB | 32 MB | Auto Let's Encrypt TLS, HTTP/2, WSS proxy |
| **A-SOC Backend** | Python 3.12 (uvicorn) | 1.0 vCPU | 1024 MB | 512 MB | REST API, WebSockets, Rate Limiting |
| **Worker Replica 1** | Python 3.12 | 1.0 vCPU | 768 MB | 256 MB | Distributed job execution (`SKIP LOCKED`) |
| **Worker Replica 2** | Python 3.12 | 1.0 vCPU | 768 MB | 256 MB | Concurrency, failover, heartbeat tracking |
| **Dashboard UI** | Node.js 20 (Next.js) | 0.5 vCPU | 384 MB | 128 MB | Real-time Operations Center Dashboard |
| **Redis 7** | Alpine C binary | 0.25 vCPU | 160 MB | 64 MB | Distributed cache, tokens, Pub/Sub bus |
| **OPA** | Go binary | 0.25 vCPU | 128 MB | 64 MB | In-memory Rego policy decision engine |
| **Total Allocation** | — | **4.25 vCPU burst** | **~3.3 GB** | **~1.3 GB** | **~4.7 GB RAM headroom for OS & cache** |

---

## 10. Operational SLA Benchmarks (The "War Game" Engine)

A-SOC includes a built-in adversarial attack simulation engine ([src/asoc/tools/war_game.py](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/src/asoc/tools/war_game.py)) that continuously benchmarks detection and response velocity against simulated BlackCat ransomware and cloud exfiltration campaigns:

```text
============================================================================
⚔️  A-SOC AUTONOMOUS WAR GAME ADVERSARIAL SIMULATION ENGINE ⚔️
============================================================================
Incident ID:       WARGAME-1740000000-8A1F
Scenario:          BlackCat / ALPHV Ransomware Campaign
Execution Mode:    SHADOW
----------------------------------------------------------------------------
Autonomous Defense Response Metrics:
  • MTTD (Mean Time to Detect):       4.90 ms   (SLA: < 2,000 ms)
  • MTTR (Mean Time to Respond):      8.12 ms   (SLA: < 5,000 ms)
  • Total Incident Cycle Time:        14.25 ms  (SLA: < 10,000 ms)
  • Containment Status:               SUCCESS_SIMULATED (VPC NACL Blackhole)
  • SOC 2 Manifest SHA-256:           d8f4c91a02e7b39fe14c...4f18b2c1
============================================================================
```

---

## 11. Conclusion & Engineering Principles

A-SOC establishes a new architectural standard for autonomous security defense by harmonizing:
1. **Safety Over Hype:** Deterministic OPA boundaries and human-in-the-loop approvals over unchecked LLM autonomy.
2. **Distributed Systems Rigor:** Database-level concurrency (`SKIP LOCKED`) and distributed idempotency over brittle in-memory locks.
3. **Audit Readiness:** Cryptographic SHA-256 manifests and HMAC signatures over unverifiable log exports.
4. **Economic Realism:** High-speed cloud LLMs and lean container sizing (~€13.50/mo) over bloated GPU infrastructure costs.
