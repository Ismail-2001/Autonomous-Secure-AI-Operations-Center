<div align="center">

# 🛡️ Autonomous Secure AI Operations Center
### **A-SOC** — Agentic Security Operations Platform

<br/>

[![CI](https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center/actions/workflows/ci.yml/badge.svg)](https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-379%20passed-brightgreen?style=flat-square)](#testing--quality-gates)
[![Coverage](https://img.shields.io/badge/coverage-51%25-green?style=flat-square)](#testing--quality-gates)
[![OPA Policies](https://img.shields.io/badge/policy%20tests-25%20passed-brightgreen?style=flat-square)](#testing--quality-gates)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2-6B3FA0?style=flat-square)](https://www.langchain.com/langgraph)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.1-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

<br/>

> *"Most security tools alert you. A-SOC acts."*

**A-SOC** is a cloud-native security operations platform that autonomously detects, investigates, and remediates threats using a coordinated fleet of specialized LLM-powered agents — with policy enforcement and human governance built in.

[**Quick Start**](#quick-start) · [**Architecture**](#architecture) · [**Testing**](#testing--quality-gates) · [**Deployment**](#deployment)

<br/>

</div>

---

## Overview

Traditional SOCs drown in alerts: thousands of low-fidelity events per day, static rules that miss novel attacks, slow manual investigation, and compliance paperwork that lags behind reality.

A-SOC replaces that with an **agent fleet** that ingests telemetry, scores risk with LLM reasoning, consults **policy-as-code (OPA)** on every decision, and executes remediation — escalating anything high-risk to a human operator before it runs.

**What works today** (all verified in CI — see [Testing](#testing--quality-gates)):

| Capability | Implementation |
|---|---|
| **Multi-agent fleet** | 7 specialized agents: Telemetry, Detection, Supervisor, Forensics, Response, Compliance, Notification |
| **LLM-powered analysis** | OpenAI, Anthropic, DeepSeek, or Ollama (local `llama3`); falls back to a deterministic mock provider when no API key is set, so the platform runs out of the box |
| **Real-time threat feed** | Native WebSocket stream (`/ws/threat-feed`) with client commands `START_SIMULATION`, `APPROVE_ACTION`, `STOP_SIMULATION` |
| **Human-in-the-loop governance** | High-risk actions pause for explicit operator authorization in the dashboard before execution |
| **Policy-as-Code** | OPA/Rego guardrails gate every proposed remediation — role-aware, risk-thresholded, versioned in git |
| **Tamper-evident audit trail** | HMAC-chained audit records for every action and decision |
| **Zero-trust API security** | RS256 JWT auth, RBAC (4 roles / 19 permissions), rate limiting |
| **Cloud telemetry ingestion** | AWS (CloudTrail), GCP, and Azure log providers via `boto3` / cloud SDKs |
| **Integrations** | Slack & Microsoft Teams webhooks, JIRA ticket creation, MITRE ATT&CK mapping, Pinecone vector store |
| **Operator dashboard** | 7-page Next.js 15 console with live feed, blast-radius graph, approvals, hunting, governance, and forensics views |
| **API surface** | 22 REST endpoints (FastAPI) + WebSocket, interactive docs at `/docs` |

---

## Tech Stack

<table>
<tr><th>Layer</th><th>Technology</th><th>Version</th><th>Role</th></tr>
<tr><td rowspan="6"><b>Backend</b></td><td><code>FastAPI</code> + Uvicorn</td><td>0.115</td><td>Async REST API &amp; WebSocket server</td></tr>
<tr><td><code>LangGraph</code></td><td>1.2</td><td>Supervisor agent orchestration workflow with checkpointing</td></tr>
<tr><td><code>LangChain</code></td><td>1.x</td><td>LLM abstraction (OpenAI / Anthropic / DeepSeek / Ollama)</td></tr>
<tr><td><code>Open Policy Agent</code></td><td>Rego v1</td><td>Policy-as-Code engine; every remediation is checked against <code>guardrails/policies/</code></td></tr>
<tr><td><code>PostgreSQL</code> + <code>Redis</code></td><td>15 / 7</td><td>Persistent state &amp; caching (asyncpg / redis-py)</td></tr>
<tr><td><code>Docker Compose</code></td><td>7 services</td><td><code>postgres</code>, <code>redis</code>, <code>opa</code>, <code>ollama</code>, <code>backend</code>, <code>worker</code>, <code>dashboard</code> — with health checks &amp; resource limits</td></tr>
<tr><td rowspan="6"><b>Frontend</b></td><td><code>Next.js</code> (App Router)</td><td>15.3</td><td>React framework; production build verified in CI (<a href="./a-soc/dashboard/TECH_DECISIONS.md">design decisions</a>)</td></tr>
<tr><td><code>React</code></td><td>19.1</td><td>UI library</td></tr>
<tr><td><code>Tailwind CSS</code></td><td>v4</td><td>Utility-first styling</td></tr>
<tr><td><code>Zustand</code> + <code>TanStack Query</code></td><td>5 / 5</td><td>Client state &amp; server cache</td></tr>
<tr><td><code>framer-motion</code></td><td>11</td><td>Animations; blast-radius graph uses <b>inline SVG</b> (no chart library)</td></tr>
<tr><td><code>Jest</code> + Testing Library / Playwright</td><td>29 / 1.x</td><td>8 unit tests + 8 E2E spec suites</td></tr>
<tr><td rowspan="2"><b>Quality</b></td><td><code>pytest</code> + coverage</td><td>—</td><td>385 tests (379 passing, 6 skipped)</td></tr>
<tr><td><code>black</code> / <code>isort</code> / <code>ESLint</code></td><td>—</td><td>Enforced in CI on every push</td></tr>
</table>

---

## Architecture

A-SOC uses a **hub-and-spoke multi-agent model**: a central Supervisor orchestrates specialist agents and enforces corporate policy (OPA) on every decision.

```
┌─────────────────────────────────────────────────────────────────┐
│                       A-SOC Agent Platform                      │
│                                                                 │
│  ┌─────────────┐    ┌────────────────────────────────────────┐  │
│  │  Log Sources │    │            Agent Fleet                  │  │
│  │─────────────│    │                                        │  │
│  │ CloudTrail  │───▶│  ① TELEMETRY AGENT                     │  │
│  │ VPC Flow    │    │     Ingests & normalizes raw log data   │  │
│  │ K8s Audit   │    │              │                         │  │
│  └─────────────┘    │              ▼                         │  │
│                     │  ② DETECTION AGENT                     │  │
│                     │     Analyzes anomalies                  │  │
│                     │     Assigns Risk Score                  │  │
│                     │              │                         │  │
│                     │              ▼                         │  │
│                     │  ③ SUPERVISOR AGENT  ◀── OPA Policy    │  │
│                     │     ┌────────────────────────┐         │  │
│                     │     │ Low risk → auto-approve │         │  │
│                     │     │ High risk → HITL gate   │         │  │
│                     │     │ Critical → hard block   │         │  │
│                     │     └────────────────────────┘         │  │
│                     │          │           │                 │  │
│                     │          ▼           ▼                 │  │
│                     │  ④ FORENSICS   Human Dashboard         │  │
│                     │     AGENT      (Blast Radius +         │  │
│                     │     (Attack     Authorize Modal)        │  │
│                     │      Graph)         │                  │  │
│                     │          │          │                  │  │
│                     │          └────┬─────┘                  │  │
│                     │               ▼                        │  │
│                     │  ⑤ RESPONSE AGENT                     │  │
│                     │     Executes remediation               │  │
│                     │     (Block IP, Revoke Keys, etc.)      │  │
│                     │               │                        │  │
│                     │               ▼                        │  │
│                     │  ⑥ COMPLIANCE AGENT                   │  │
│                     │     Maps incident → SOC2 / ISO 27001  │  │
│                     │     Logs cryptographic evidence        │  │
│                     └────────────────────────────────────────┘  │
│                          ⑦ NOTIFICATION AGENT                   │
│                             Slack / Teams webhooks, JIRA        │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Responsibilities

| Agent | Role |
|---|---|
| **① Telemetry** | Ingests and normalizes logs from AWS CloudTrail, GCP Cloud Logging, and Azure Monitor into a unified event schema (demo provider runs without credentials). |
| **② Detection** | LLM-powered anomaly detection and correlation; assigns a continuous risk score and maps findings to MITRE ATT&CK techniques. |
| **③ Supervisor** | The orchestrator. Routes every detection through OPA policy: low risk auto-approves, high risk escalates to human approval, critical actions hard-block. Enforces quality gates on agent output (confidence, completeness) with retry-then-escalate behavior. |
| **④ Forensics** | Builds the **blast radius** — the set of resources touched, compromised, or at risk — and persists artifacts to the vector index. |
| **⑤ Response** | Executes approved remediation playbooks (IP block, IAM revocation, quarantine) with an explicit target/reason contract. |
| **⑥ Compliance** | Maps incidents to SOC 2 / ISO 27001 controls and writes HMAC-chained, tamper-evident audit records. |
| **⑦ Notification** | Fans approved incidents out to Slack / Microsoft Teams webhooks and opens JIRA tickets. |

---

## Security Design

Defense-in-depth applied to the platform itself:

- **Least privilege per agent** — agents only get the tools their role allows; the Compliance agent cannot execute remediations.
- **Human-in-the-loop for high-stakes actions** — IAM revocation, firewall changes, and instance termination require explicit operator authorization; if OPA is unreachable, a local guardrail still blocks high-risk destructive actions (and every fallback decision is logged).
- **Policy-as-Code** — governance lives in versioned, reviewable Rego files under [`a-soc/guardrails/policies/`](./a-soc/guardrails/policies), tested in CI like any other code.
- **Zero-trust API** — RS256 JWT access/refresh tokens, 4-role RBAC (`readonly` / `analyst` / `supervisor` / `admin` with 19 distinct permissions), rate limiting on sensitive routes, and a separate WebSocket token (`WS_API_TOKEN`).
- **Tamper-evident audit** — every action is hash-chained with HMAC, so silent log edits are detectable.
- **Secure defaults in configuration** — secrets come from environment variables; `.env.example` ships with non-production defaults that CI and docker health checks verify.

---

## Quick Start

### Prerequisites

- **Python 3.11+** (CI runs on 3.12)
- **Node.js 20+**
- **Docker & Docker Compose** *(recommended)*
- Optional: an API key for **OpenAI / Anthropic / DeepSeek**, or a local **Ollama** server — without one, A-SOC runs on a deterministic mock LLM provider

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center.git
cd Autonomous-Secure-AI-Operations-Center/a-soc

cp .env.example .env          # add an LLM API key if you have one (optional)
docker compose up -d
docker compose ps             # all 7 services should become healthy
```

- Dashboard: **http://localhost:3000**
- API + interactive docs: **http://localhost:9002/docs**

### Option B — Manual setup

```bash
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center.git
cd Autonomous-Secure-AI-Operations-Center/a-soc

# Backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -e ".[dev]"           # same install CI uses
cp .env.example .env              # optional — mock provider works with no key
python -m uvicorn src.asoc.api.app:app --host 0.0.0.0 --port 9002

# Frontend (in a second terminal)
cd dashboard
npm install
npm run dev                       # http://localhost:3000
```

### Key environment variables

| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | `openai` \| `anthropic` \| `deepseek` \| `ollama` (falls back to mock if no key) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` | Provider credentials |
| `LOCAL_LLM_MODEL` / `LOCAL_LLM_BASE_URL` | Ollama model (default `llama3`) and URL |
| `DATABASE_URL` / `REDIS_URL` | PostgreSQL (asyncpg) and Redis connection strings |
| `OPA_URL` | Policy engine endpoint (default `http://localhost:8181`) |
| `HMAC_SECRET` | Signing key for the tamper-evident audit chain |
| `WS_API_TOKEN` | Token required by the `/ws/threat-feed` WebSocket |
| `AWS_*` / `GCP_*` / `AZURE_*` | Cloud telemetry credentials (optional) |

Full list: [`a-soc/.env.example`](./a-soc/.env.example) (51 variables).

### Using the dashboard

1. Open **http://localhost:3000** and sign in (seeded dev credentials: `admin` / `admin123` — change them outside local dev).
2. Click **Start Simulation** to stream synthetic threat telemetry through the fleet.
3. Watch detections appear with risk scores; inspect the **blast radius** graph.
4. When a high-risk action is proposed, review context in the **authorize modal** and approve to execute — or deny.
5. Audit every action under **Governance**.

---

## Testing & Quality Gates

Every gate below runs in CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) on each push to `main`:

| Gate | Command | Current result |
|---|---|---|
| Python test suite | `pytest tests/` | **379 passed, 6 skipped** |
| Statement coverage | `pytest tests/ --cov` | **51%** |
| OPA policy tests | `opa test guardrails/policies -v` | **25 passed** |
| Frontend unit tests | `npm test` | **8 passed** |
| Formatting | `black --check` / `isort --check` | clean (154 files) |
| Frontend lint | `npm run lint` (ESLint 9) | 0 errors |
| Production build | `npm run build` | passes (7 routes) |
| E2E | `npx playwright test` (8 spec suites) | runs in CI against the full stack |
| Deployment verification | `docker compose up` + smoke checks | health checks for all 7 services |

Quick local run:

```bash
# Backend
cd a-soc
python -m pytest tests/ -q --cov

# Policies (requires opa on PATH)
cd guardrails/policies && opa test . -v && cd ../..

# Frontend
cd dashboard && npm run lint && npm test && npm run build
```

Performance methodology and results: [`a-soc/BENCHMARKS.md`](./a-soc/BENCHMARKS.md).

---

## Project Structure

```
Autonomous-Secure-AI-Operations-Center/
├── .github/workflows/        # CI: pytest, black/isort, OPA tests, ESLint, Playwright, compose verify
├── LICENSE
├── README.md
└── a-soc/
    ├── src/asoc/
    │   ├── agents/           # 7 agents (telemetry, detection, supervisor, forensics,
    │   │                     #   response, compliance, notification)
    │   ├── api/              # FastAPI app, 22 REST routes, WebSocket endpoint
    │   ├── orchestration/    # LangGraph supervisor workflow
    │   ├── core/             # config, structured logging, JWT/RBAC, rate limiting
    │   ├── llm/              # LLM providers (OpenAI/Anthropic/DeepSeek/Ollama/mock)
    │   ├── mitre/            # MITRE ATT&CK technique mapping
    │   └── vector/           # Pinecone vector provider
    ├── guardrails/policies/  # OPA Rego policies + 25 policy tests
    ├── tests/                # 385 pytest tests (e2e/, performance/)
    ├── dashboard/            # Next.js 15 operator console (Jest + Playwright)
    ├── k8s/                  # Kubernetes manifests
    ├── docker-compose.yml    # 7-service stack with health checks
    ├── .env.example          # all 51 environment variables, documented
    └── DEPLOYMENT.md         # production deployment guide
```

---

## Deployment

Full guide: [`a-soc/DEPLOYMENT.md`](./a-soc/DEPLOYMENT.md) — covers Docker Compose, AWS ECS (Fargate), Kubernetes, Vercel (dashboard only), environment variables, monitoring & logs, scaling, backup/recovery, and security hardening.

| Target | Backend | Frontend | Guide |
|---|---|---|---|
| **Docker Compose** | ✅ | ✅ | `docker compose up -d` (7 services) |
| **AWS ECS Fargate** | ✅ | ✅ S3 + CloudFront | [DEPLOYMENT.md](./a-soc/DEPLOYMENT.md) |
| **Kubernetes** | ✅ | ✅ Ingress | [`a-soc/k8s/`](./a-soc/k8s/) (7 manifests) |
| **Vercel** | — | ✅ | [DEPLOYMENT.md](./a-soc/DEPLOYMENT.md) |

---

## Project Status

| Area | Status |
|---|---|
| Core multi-agent pipeline, HITL, RBAC, audit trail | ✅ Shipped — covered by 379 passing tests |
| OPA policy guardrails | ✅ Shipped — 25 policy tests in CI |
| Dashboard (7 pages), unit tests, lint, production build | ✅ Shipped |
| Playwright E2E (8 specs) + docker-compose smoke verification | ✅ Wired into CI |
| Cloud telemetry providers (AWS / GCP / Azure) | ✅ Implemented |
| Notifications (Slack / Teams / JIRA), MITRE ATT&CK, Pinecone | ✅ Implemented |
| Local LLM via Ollama (`llama3`) | ✅ Implemented |
| Performance benchmarks | ✅ [`a-soc/BENCHMARKS.md`](./a-soc/BENCHMARKS.md) |

Known limitations are tracked in [`a-soc/CHANGELOG.md`](./a-soc/CHANGELOG.md).

---

## Contributing

1. Fork and branch: `git checkout -b feature/your-feature`
2. Make your change **with tests** (new agent logic needs pytest coverage; new policies need Rego tests)
3. Run the gates locally before pushing:

   ```bash
   cd a-soc
   python -m pytest tests/ -q
   black --check --line-length 120 .
   isort --check-only --profile black --line-length 120 .
   (cd guardrails/policies && opa test . -v)
   cd dashboard && npm run lint && npm test
   ```

4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) and open a PR against `main`

CI re-runs every gate automatically; PRs with red checks won't merge cleanly.

---

## License

Distributed under the **MIT License** — see [`LICENSE`](./LICENSE).

---

<div align="center">

**Built with obsession for security, AI, and clean architecture.**

*If A-SOC helped you or inspired your work, consider starring ⭐ the repository.*

[![GitHub Stars](https://img.shields.io/github/stars/Ismail-2001/Autonomous-Secure-AI-Operations-Center?style=social)](https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center)

</div>
