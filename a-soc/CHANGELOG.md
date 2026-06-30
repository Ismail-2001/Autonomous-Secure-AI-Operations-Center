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
- Python 3.15 environment lacks pydantic-core binary wheels — syntax validation only

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
