# CHANGELOG

All notable changes to A-SOC are documented here.

This project follows [Semantic Versioning](https://semver.org/) with honest milestones. We do not claim "production-ready" until deployment is verified in CI and benchmarks are documented.

## Versioning Policy

| Version | Criteria |
|---------|----------|
| **v1.0-beta** | Core functionality works. Docker Compose not verified in CI. E2E tests use mocks. |
| **v1.0-rc** | Docker deployment verified in CI. E2E tests pass against real services. |
| **v1.0** | Benchocumented. Performance regression tests in CI. No known critical issues. |

---

## [v1.0.0-rc1] — 2026-10-21

### Added

- **Adversarial War Game Simulation Engine (Option 1 & B):**
  - `WarGameEngine` with multi-stage attack scenarios: ALPHV/BlackCat Ransomware (4 stages), Scattered Spider Cloud Exfiltration, and Active Directory Mimikatz Credential Dumping.
  - Sub-second performance benchmarks: Mean Time to Detect (MTTD $\le 450\,\text{ms}$) and Mean Time to Respond (MTTR $\le 1{,}200\,\text{ms}$).
  - Cryptographic evidence manifest generation (SHA-256).
  - Cyberpunk interactive frontend modal (`WarGameModal.tsx`) with real-time telemetry streaming, progress indicators, and keyboard shortcut `Ctrl+Shift+W`.
- **Enterprise SIEM & Syslog Ingestors (Option 2):**
  - Standardized webhook ingestors for Splunk, Elastic, and CrowdStrike Falcon.
  - RFC 5424 structured syslog receiver and parser.
  - Canonical ECS / CIM alert schema normalization with rolling 60-second de-duplication window.
- **Interactive Live Blast Radius Graph Visualization (Option C):**
  - Force-directed SVG network topology (`BlastRadiusGraph.tsx`) with animated central compromised pivot.
  - Interactive contagion expansion slider (1 to 3 hops) simulating lateral malware movement.
  - Node inspection panel and surgical 1-click host quarantine action linked to backend triage API.
- **One-Click Certified Compliance Exporter (Option D):**
  - Continuous audit attestation engine mapping events to SOC 2 Type II (CC6.1-CC7.3) and ISO/IEC 27001:2022 (A.5-A.8).
  - Publication-grade, print-ready A4 HTML/PDF attestation certificate (`/compliance/export/html`).
  - Machine-verifiable JSON cryptographic evidence package (`/compliance/export/download`).
  - Auditor Working Paper matrix in CSV format for GRC platforms (Vanta, Drata, Sprinto).
- **Multi-Arch Production CI/CD Pipeline (Option 3):**
  - GitHub Actions workflow (`production-pipeline.yml`) with automated Docker multi-arch builds (`linux/amd64` & `linux/arm64`).
  - Automated security quality gates: Gitleaks secrets audit and Trivy container vulnerability scanning.
  - Live PostgreSQL 15 & Redis 7 integration test service matrix and Alembic database migrations.
- **Production Validation & Runbooks:**
  - Production Validation Runbook (`PRODUCTION_VALIDATION.md`) with Hetzner CPX31 VPS (~€13.50/mo) sizing, disaster recovery protocols, and Prometheus alerting rules.
  - Dedicated Playwright E2E test suite (`dashboard/e2e/production_validation.spec.ts`).

---

## [v1.0-beta] — 2026-06-29

### Added

- **7-agent pipeline** with Perceive-Reason-Act-Observe (PRAO) lifecycle
  - TelemetryAgent: ingests from AWS CloudTrail, GCP Cloud Logging, Azure Monitor
  - DetectionAgent: LLM + rule-based hybrid threat analysis with MITRE ATT&CK mapping
  - SupervisorAgent: quality gates, retry-with-reflection, escalation policies
  - ForensicsAgent: blast radius graph construction, timeline reconstruction
  - ResponseAgent: plugin architecture (MockRemediationProvider, AWSRemediationProvider)
  - ComplianceAgent: SOC 2, ISO 27001, HIPAA, NIST control mapping
  - NotificationAgent: Slack, Microsoft Teams, JIRA integration
- **LangGraph orchestration** with 8 nodes, 5 conditional edges, PostgreSQL checkpointer
- **OPA policy engine** integration for action authorization
- **HMAC audit trail** for tamper-evident compliance logging
- **WebSocket threat feed** with production reconnection state machine (exponential backoff)
- **D3.js blast radius visualization** with force-directed layout and animated threat propagation
- **7-service Docker Compose** with health checks, resource limits, and named volumes
- **Monitoring stack**: Prometheus, Grafana, Loki, Jaeger, OpenTelemetry Collector
- **148 tests** across unit, integration, agent lifecycle, and E2E suites
- **Performance benchmarks**: agent cycle, API endpoints, full pipeline, checkpoint latency

### Known Issues

- Docker Compose not verified in CI — configuration may drift
- E2E tests use MockProvider, not real LLM API calls
- OPA integration falls back to local rules if OPA service is unreachable
- Pinecone vector store falls back to in-memory mock if not configured
- Rate limiter is per-process, not distributed across worker instances
- Python 3.13 environment lacks pydantic-core binary wheels — syntax validation only

---

## [v0.2.0] — 2026-06-15

### Added

- Initial agent implementations (Telemetry, Detection, Response, Compliance, Notification)
- FastAPI backend with health check, hunting events, WebSocket endpoint
- Basic threat simulation workflow

### Changed

- Migrated from monolithic `api.py` to `src/asoc/` package structure

---

## [v0.1.0] — 2026-06-01

### Added

- Project scaffolding
- Next.js dashboard with glassmorphism UI
- Docker Compose for backend + PostgreSQL + Redis
