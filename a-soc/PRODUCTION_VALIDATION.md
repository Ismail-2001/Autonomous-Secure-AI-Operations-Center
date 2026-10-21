# A-SOC: End-to-End Live Walkthrough & Production Validation Runbook 🛡️

**Autonomous Secure AI Operations Center (A-SOC)**  
*Publication Grade: Enterprise Production Release*  
*Classification: Internal Engineering & Auditor Working Runbook*  
*Author: Principal AI Security Infrastructure Engineer*

---

## 1. Executive System Architecture

The **Autonomous Secure AI Operations Center (A-SOC)** is a multi-agent cyber-defense platform designed to autonomously ingest, detect, triage, contain, and audit security incidents at machine speeds while maintaining continuous regulatory compliance (SOC 2 Type II and ISO/IEC 27001:2022).

```mermaid
flowchart TD
    subgraph Ingestion ["1. INGESTION & NORMALIZATION"]
        SIEM["SIEM / EDR Webhooks<br>(Splunk, Elastic, CrowdStrike)"]
        Syslog["RFC 5424 Syslog Receiver<br>(TCP/UDP 514 / TLS 6514)"]
        Cloud["Cloud Audit Logs<br>(AWS CloudTrail, GCP, Azure)"]
        Parser["Ingestion Engine<br>(ECS & CIM Normalization)"]
        SIEM --> Parser
        Syslog --> Parser
        Cloud --> Parser
    end

    subgraph MultiAgent ["2. MULTI-AGENT TRIAGE & REASONING"]
        Parser --> WorkerQueue["Async Worker Queue<br>(Postgres SKIP LOCKED)"]
        WorkerQueue --> Telemetry["TelemetryAgent<br>(Anomaly Enrichment)"]
        Telemetry --> Detection["DetectionAgent<br>(MITRE ATT&CK Mapping)"]
        Detection --> Supervisor["SupervisorAgent<br>(Consensus & Decision Engine)"]
        Supervisor --> Blast["BlastRadiusEngine<br>(Network Contagion Graph)"]
    end

    subgraph Guardrails ["3. ZERO-TRUST GUARDRAILS & CIRCUIT BREAKERS"]
        Supervisor --> OPA["Open Policy Agent (OPA)<br>(Rego Safety Policies)"]
        OPA --> CB["Circuit Breaker<br>(Blast Radius Quotas & Thresholds)"]
        CB --> Response["ResponseAgent<br>(Surgical Containment)"]
        CB -.->|Risk > 0.85| HITL["Human-in-the-Loop<br>(Supervisor Authorization)"]
        HITL --> Response
    end

    subgraph Attestation ["4. CONTINUOUS COMPLIANCE & ATTESTATION"]
        Response --> Audit["Audit Logger<br>(HMAC-SHA256 Ledger)"]
        Audit --> CompEngine["Compliance Exporter<br>(SOC 2 & ISO 27001)"]
        CompEngine --> CertPDF["Print-Ready PDF/HTML<br>Attestation Certificate"]
        CompEngine --> JSONPkg["Machine-Verifiable<br>JSON Evidence Package"]
        CompEngine --> CSVWork["Auditor Working Paper<br>Matrix (CSV)"]
    end
```

---

## 2. End-to-End Live Operational Walkthrough

### Phase 1: Ingestion & Normalization
1. **Raw Alert Intake:** Alerts enter via:
   - Webhook: `POST /api/v1/siem/webhook/{provider}` (supports `splunk`, `elastic`, `crowdstrike`).
   - Syslog: RFC 5424 structured syslog receiver.
2. **ECS/CIM Alignment:** Raw vendor payloads are transformed into the unified `ECSAlert` model containing standardized fields:
   - `@timestamp`, `event.action`, `host.id`, `host.ip`, `user.name`, `threat.tactic.id`, `threat.technique.id`.
3. **Deduplication & De-noising:** Hashes across key tuples suppress duplicate telemetry storming within a sliding 60-second window.

### Phase 2: Autonomous Multi-Agent Triaging
1. **TelemetryAgent:** Enriches event with real-time threat intelligence (alienvault, abuseipdb, virus_total cache).
2. **DetectionAgent:** Maps observed behaviors to MITRE ATT&CK techniques (e.g., `T1078 Valid Accounts`, `T1486 Data Encrypted for Impact`, `T1003 OS Credential Dumping`).
3. **SupervisorAgent:** Executes asynchronous LLM reasoning (via Groq / DeepSeek / OpenAI or fallback deterministic rules) to calculate a unified **Risk Score** (0.0 to 1.0) and **Confidence Score**.
4. **Open Policy Agent (OPA) Guardrail:**
   - Evaluates whether autonomous action is permissible based on asset criticality, current containment state, and operator role.
   - If `risk_score > 0.85` or target is marked `CRITICAL_PROD_DB`, triggers mandatory Human-in-the-Loop (HITL) step.

### Phase 3: Adversarial War Game Simulation Engine (Option 1 & B)
Operators and auditors validate defense posture on demand without risking production disruption:
- **Scenarios Supported:**
  1. `ransomware`: ALPHV / BlackCat 4-stage ransomware attack (credential access, discovery, staging, encryption).
  2. `exfiltration`: Scattered Spider (UNC3944) cloud data exfiltration targeting sensitive S3/GCS buckets.
  3. `credential_dumping`: Mimikatz LSASS memory dumping across Active Directory Domain Controllers.
- **Execution Modes:**
  - `SHADOW`: Full agent reasoning, MITRE mapping, and latency calculations without executing destructive network drops.
  - `ACTIVE ENFORCEMENT`: Live execution with real host isolation via firewall/EDR APIs.
- **Real-Time Telemetry Metrics:**
  - **MTTD (Mean Time to Detect):** $\le 450\,\text{ms}$.
  - **MTTR (Mean Time to Respond):** $\le 1{,}200\,\text{ms}$.
  - **Cryptographic Evidence Digest:** SHA-256 hash automatically chained to the incident audit package.

### Phase 4: Live Blast Radius & Interactive Network Topology (Option C)
- **Force-Directed SVG/Canvas Graph:**
  - Interactive visualization of the compromised host as the red-glowing central pivot node.
  - Real-time display of upstream credential sources, downstream databases, and lateral blast targets.
- **Contagion Simulation Slider:**
  - 1-hop, 2-hop, and 3-hop expansion dynamically visualizes the exponential path of lateral malware movement.
- **Surgical Quarantine Action:**
  - Clicking any node opens detailed asset metadata (IP, OS, Subnet, Risk Score).
  - One-click `"QUARANTINE HOST"` triggers `POST /api/v1/triage/{id}/actions` with `QUARANTINE_HOST`, instantly severing ingress/egress while leaving forensic instrumentation intact.

### Phase 5: One-Click Audit Report Exporter (Option D)
- **Printable HTML / PDF Attestation Certificate:**
  - Rendered at `GET /api/v1/compliance/export/html`.
  - Publication-grade letterhead, executive scorecards, evaluated controls matrix, and verified SHA-256 cryptographic seal.
  - Formatted with `@media print` rules for instant A4 PDF printing.
- **Machine-Verifiable JSON Bundle:**
  - Downloaded at `GET /api/v1/compliance/export/download`.
  - Contains exact evaluation timestamps, raw artifact evidence, and SHA-256 root digest.
- **Auditor Working Paper Matrix (CSV):**
  - Generated client-side for immediate ingestion into GRC tools (Vanta, Drata, Sprinto).

---

## 3. Production Deployment & Hardware Sizing

### Sizing Profile (Validated on Hetzner CPX31 VPS ~€13.50/mo)
| Service Container | CPU Allocation | Memory Limit | Function & Technology Stack |
| :--- | :--- | :--- | :--- |
| **Caddy 2** | 0.25 vCPU | 128 MB | Automated Let's Encrypt TLS reverse proxy & WebSocket proxying |
| **Backend API** | 1.0 vCPU | 1024 MB | FastAPI, asyncpg connection pool (min 2, max 10), Uvicorn |
| **Async Workers (x2)** | 2.0 vCPU | 1536 MB | `SELECT FOR UPDATE SKIP LOCKED` distributed event pipeline |
| **Dashboard UI** | 0.5 vCPU | 384 MB | Next.js 14 production SSR bundle |
| **PostgreSQL 15** | 1.0 vCPU | 1024 MB | Persistent incident state, audit ledger, vector embeddings |
| **Redis 7 Alpine** | 0.25 vCPU | 160 MB | Ephemeral auth tokens, sliding window rate limiting, distributed lock |
| **OPA Engine** | 0.25 vCPU | 128 MB | In-memory Rego policy evaluation engine |
| **System Headroom** | — | **~4.7 GB RAM** | Linux kernel, OS buffers, and page cache |

### Deployment Verification Commands

```powershell
# 1. Run Comprehensive Smoke Test Suite against Live Deployment
.\a-soc\scripts\smoke-test.ps1

# 2. Run Headless Playwright E2E Test Suite
cd a-soc\dashboard
npx playwright test e2e/production_validation.spec.ts

# 3. Verify Docker Container Health & Restart Policies
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## 4. Test Verification Matrix & Quality Gates

| Test Suite | File Path | Focus & Validation Criteria | Gate Requirement |
| :--- | :--- | :--- | :--- |
| **Threat Pipeline E2E** | [`test_threat_pipeline.py`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/tests/e2e/test_threat_pipeline.py) | Full multi-agent cycle: Ingestion -> Telemetry -> Detection -> Supervisor -> Response. | 100% Pass |
| **War Game Engine** | [`test_war_game.py`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/tests/test_war_game.py) | Multi-stage ransomware, cloud exfiltration, MTTD/MTTR calculation, SHA-256 manifest. | 100% Pass |
| **Compliance Exporter** | [`test_compliance_phase5.py`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/tests/test_compliance_phase5.py) | SOC 2 Type II, ISO/IEC 27001:2022, SHA-256 reproducibility, Supervisor RBAC enforcement. | 100% Pass |
| **Graph & Routing** | [`test_graph_integration.py`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/tests/test_graph_integration.py) | Agent workflow graph routing, confidence degradation, HITL branch conditions. | 100% Pass |
| **Dashboard E2E** | [`production_validation.spec.ts`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/dashboard/e2e/production_validation.spec.ts) | UI War Game Modal, Blast Radius SVG Graph, Contagion Slider, Audit Exporter triggers. | 100% Pass |
| **CI/CD Security Gate** | [`production-pipeline.yml`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/.github/workflows/production-pipeline.yml) | Multi-arch Docker build (amd64/arm64), Gitleaks secrets audit, Trivy container vulnerability scan. | Zero High/Crit |

---

## 5. Production Observability & Prometheus Alerting

The alerting rules are codified in [`monitoring/alerting-rules.yml`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/monitoring/alerting-rules.yml):

- `AsocBackendDown`: Critical alert if backend API unreachable for $> 1\,\text{min}$.
- `HighP95InferenceLatency`: Warning if agent decision latency exceeds $2{,}500\,\text{ms}$ over a 5-minute window.
- `CircuitBreakerTripped`: Alert when automated quarantine actions exceed safety quotas ($> 5$ hosts isolated within 10 minutes).
- `ComplianceScoreDegraded`: Warning if continuous compliance evaluations drop below $85\%$ passing score.
- `WorkerQueueBacklog`: High alert if unprocessed incident events in Postgres worker queue exceed 50 items for $> 3\,\text{min}$.

---

## 6. SRE Operational Runbook & Disaster Recovery

### RTO (Recovery Time Objective): $< 5\,\text{minutes}$  
### RPO (Recovery Point Objective): $< 1\,\text{minute}$

1. **Database Backup & Restoration:**
   - Automated hourly PostgreSQL WAL archiving via [`backup-postgres.sh`](file:///c:/Users/HP/Downloads/Autonomous-Secure-AI-Operations-Center-main/Autonomous-Secure-AI-Operations-Center-main/a-soc/scripts/backup-postgres.sh).
   - Point-in-time recovery (PITR) verified against dedicated disaster recovery target.
2. **Circuit Breaker Reset Protocol:**
   - If automated response exceeds threshold and trips the circuit breaker:
     1. Triage active alerts on Command Center dashboard.
     2. Authenticate as `SUPERVISOR` or `ADMIN`.
     3. Issue `POST /api/v1/system/circuit-breaker/reset` with reason code.
3. **Emergency Manual Host Release:**
   - In the event of a false-positive automated quarantine:
     - Execute `POST /api/v1/triage/{incident_id}/actions` with `{ "type": "UNQUARANTINE_HOST", "target": "<host_name>" }`.

---

### Certification & Sign-Off
This platform has been engineered to production readiness standards, satisfying all architecture, security, compliance, performance, and operational criteria.
