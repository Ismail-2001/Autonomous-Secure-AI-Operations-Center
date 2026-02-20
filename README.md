<div align="center">

# 🛡️ Autonomous Secure AI Operations Center
### **A-SOC** — Next-Generation Agentic Cybersecurity Platform

<br/>

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent%20Orchestration-6B3FA0?style=for-the-badge&logo=langchain&logoColor=white)](https://www.langchain.com/langgraph)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

<br/>

> *"Most security tools alert you. A-SOC acts."*

**A-SOC** is a cloud-native, AI-native security operations platform that autonomously detects, investigates, and remediates threats using a coordinated fleet of specialized LLM-powered agents — with human governance built in.

[**🚀 Quick Start**](#️-installation--setup) · [**🏗️ Architecture**](#️-architecture) · [**🎮 Demo**](#-usage) · [**🚢 Deploy**](#-deployment)

---

</div>

## 📌 The Problem

Traditional Security Operations Centers (SOCs) are **drowning in alerts**. Analysts face:

- **Thousands of low-fidelity alerts** daily, leading to alert fatigue
- **Static, rule-based SIEMs** that miss novel, zero-day attack patterns
- **Slow mean-time-to-respond (MTTR)** due to manual investigation workflows
- **Compliance documentation** that is tedious, inconsistent, and error-prone

**A-SOC solves all of this with a coordinated fleet of AI agents.**

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| **🕵️ Multi-Agent Architecture** | Specialized agents (Telemetry, Detection, Forensics, Response, Compliance) operate as a coordinated team |
| **🧠 LLM-Powered Analysis** | LLMs contextualize alerts, dramatically reducing false positives vs. static rules |
| **⚡ Real-Time Threat Streaming** | WebSocket-based live feed pushes events to the dashboard as they happen |
| **🛑 Human-in-the-Loop Governance** | High-risk actions (IAM revocation, firewall changes) require explicit human authorization |
| **🕸️ Blast Radius Visualization** | Interactive attack graph shows which resources are affected and how far the threat can spread |
| **📜 Immutable Audit Trail** | Every action and LLM decision is cryptographically logged for SOC2/ISO 27001 compliance |
| **👮 Policy-as-Code** | Open Policy Agent (OPA) enforces corporate policy on every proposed remediation action |
| **🎨 Premium Dashboard** | Cinematic, glassmorphism UI built with Next.js 14, providing a state-of-the-art operator experience |

---

## 🛠️ Tech Stack

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Purpose</th>
</tr>
<tr>
<td rowspan="6"><b>Backend</b></td>
<td><code>FastAPI</code></td>
<td>High-performance async REST API & WebSocket server</td>
</tr>
<tr>
<td><code>LangGraph</code></td>
<td>Agent state machine & multi-agent orchestration</td>
</tr>
<tr>
<td><code>LangChain</code></td>
<td>LLM abstraction layer (OpenAI / Anthropic / DeepSeek)</td>
</tr>
<tr>
<td><code>Open Policy Agent (OPA)</code></td>
<td>Policy-as-Code engine with Rego for governance</td>
</tr>
<tr>
<td><code>PostgreSQL + Redis</code></td>
<td>Persistent state storage & real-time caching</td>
</tr>
<tr>
<td><code>Docker Compose</code></td>
<td>Containerized local and production deployment</td>
</tr>
<tr>
<td rowspan="4"><b>Frontend</b></td>
<td><code>Next.js 14</code></td>
<td>React framework with App Router for the operator dashboard</td>
</tr>
<tr>
<td><code>Tailwind CSS</code></td>
<td>Utility-first styling & glassmorphism design system</td>
</tr>
<tr>
<td><code>React Flow / Custom SVG</code></td>
<td>Interactive blast radius attack graph visualization</td>
</tr>
<tr>
<td><code>WebSockets</code></td>
<td>Real-time bidirectional event streaming to the UI</td>
</tr>
</table>

---

## 🏗️ Architecture

A-SOC operates on a **Hub-and-Spoke multi-agent model**, orchestrated by a central Supervisor agent that enforces corporate policy on every decision and routes tasks to the appropriate specialist.

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
│                     │     Assigns Risk Score (0–100)          │  │
│                     │              │                         │  │
│                     │              ▼                         │  │
│                     │  ③ SUPERVISOR AGENT  ◀── OPA Policy    │  │
│                     │     ┌────────────────────┐             │  │
│                     │     │ Risk < 70?          │             │  │
│                     │     │ YES → Auto-remediate│             │  │
│                     │     │ NO  → Human Approval│             │  │
│                     │     └────────────────────┘             │  │
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
└─────────────────────────────────────────────────────────────────┘
```

### Agent Responsibilities

| Agent | Role |
|---|---|
| **① Telemetry Agent** | Ingests and normalizes logs from CloudTrail, VPC Flow Logs, and Kubernetes Audit logs into a unified event schema. |
| **② Detection Agent** | Applies LLM-powered reasoning to identify anomalies, correlate events, and assign a continuous **Risk Score (0–100)**. |
| **③ Supervisor Agent** | The orchestrator. Evaluates every detection against OPA policies and routes: `score < 70` → auto-remediate, `score ≥ 70` → escalate to human. |
| **④ Forensics Agent** | Constructs the **Blast Radius** — a real-time graph of which resources have been touched, compromised, or are at risk. |
| **⑤ Response Agent** | Executes the approved remediation playbook. Actions include IP blocking, credential revocation, and quarantine. |
| **⑥ Compliance Agent** | Automatically maps every incident and action to compliance frameworks (SOC2, ISO 27001) and writes immutable, signed audit records. |

---

## 🔐 Security Design Principles

A-SOC is designed with a **defense-in-depth** philosophy applied to the platform itself:

- **Principle of Least Privilege**: Each agent only has the tool-access it needs. The Compliance Agent cannot execute remediations.
- **Immutable Audit Log**: All LLM reasoning chains and tool invocations are stored with cryptographic signatures, making them tamper-evident.
- **Human-in-the-Loop for High-Stakes Actions**: No IAM key revocation, firewall rule change, or instance termination can happen without explicit operator authorization. The system is designed to make humans the last line of defense, not the bottleneck.
- **Policy-as-Code via OPA**: Governance is not hardcoded in Python. It lives in versioned, reviewable **Rego policy files**, making it auditable and easy to update.
- **Zero Trust Agent Communication**: Inter-agent communication is mediated by the LangGraph state machine, with no direct side-channel communication between agents.

---

## ⚙️ Installation & Setup

### Prerequisites

Ensure the following are installed on your machine:

- **Python** `3.10+`
- **Node.js** `18+`
- **Docker & Docker Compose** *(optional, but recommended)*
- An API key for **OpenAI** or **Anthropic**

---

### Option A: Docker Compose (Recommended)

The fastest way to get the full A-SOC stack running locally.

```bash
# 1. Clone the repository
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center.git
cd Autonomous-Secure-AI-Operations-Center/a-soc

# 2. Configure your environment
cp .env.example .env
# Open .env and add your OPENAI_API_KEY (or ANTHROPIC_API_KEY)

# 3. Launch the entire stack (API + Dashboard + PostgreSQL + Redis)
docker-compose up -d

# 4. Verify all services are healthy
docker-compose ps
```

✅ Dashboard is live at **`http://localhost:3000`**
✅ API is live at **`http://localhost:9001/docs`**

---

### Option B: Manual Setup

#### Step 1 — Clone the Repository
```bash
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center.git
cd Autonomous-Secure-AI-Operations-Center/a-soc
```

#### Step 2 — Backend Setup
```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate       # macOS/Linux
# venv\Scripts\activate        # Windows

# Install backend dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env — at minimum, set OPENAI_API_KEY

# Start the API server on port 9001
python -m uvicorn api:app --host 0.0.0.0 --port 9001 --reload
```

#### Step 3 — Frontend Setup
```bash
# From the project root, navigate to the dashboard
cd dashboard

# Install frontend dependencies
npm install

# Start the development server (port 3000)
npm run dev
```

#### Step 4 — Configure Environment Variables

Copy `.env.example` to `.env` and populate the following:

```bash
# --- LLM Provider (choose one) ---
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# --- Database ---
DATABASE_URL=postgresql://user:password@localhost:5432/asoc
REDIS_URL=redis://localhost:6379

# --- Security ---
SECRET_KEY=your-super-secret-key-here

# --- OPA Policy Engine ---
OPA_URL=http://localhost:8181
```

---

## 🎮 Usage

Once both backend and frontend are running:

1.  **Open the Dashboard** → Navigate to `http://localhost:3000`
2.  **Start a Simulation** → Click the **"Start Simulation"** button in the top right corner
3.  **Watch the Agent Fleet** → Observe the real-time log stream as each agent processes incoming threat telemetry
4.  **Review Detections** → See risk scores assigned and watch the Blast Radius graph build dynamically
5.  **Authorize a High-Risk Action** → When the **"High Risk Action Proposed"** modal appears, review the full context and Blast Radius, then click **"Authorize"** to execute the remediation

---

## 🚢 Deployment

### Production Deployment

For production environments, see the detailed [**DEPLOYMENT.md**](./DEPLOYMENT.md) guide which covers:

- **AWS ECS (Fargate)**: Scalable serverless container deployment
- **Kubernetes**: Full Helm chart manifests in [`k8s/`](./k8s/)
- **Vercel**: Frontend-only serverless deployment
- **Monitoring**: Prometheus + Grafana stack integration
- **Security Hardening**: TLS, secrets management, WAF configuration

### Cloud Platform Summary

| Platform | Backend | Frontend | Guide |
|---|---|---|---|
| **AWS ECS Fargate** | ✅ Supported | ✅ S3 + CloudFront | [DEPLOYMENT.md#aws](./DEPLOYMENT.md#aws-ecs-deployment) |
| **Kubernetes** | ✅ Any cluster | ✅ Ingress | [k8s/](./k8s/) |
| **Docker Compose** | ✅ Self-hosted | ✅ Included | `docker-compose up -d` |
| **Vercel** | ❌ | ✅ Serverless | [DEPLOYMENT.md#vercel](./DEPLOYMENT.md#vercel-dashboard-only) |

---

## 🗺️ Roadmap

**v1.0 — Core Platform (Complete ✅)**
- [x] Multi-Agent orchestration via LangGraph
- [x] Real-time WebSocket event streaming
- [x] Human-in-the-Loop approval workflow
- [x] Interactive Blast Radius visualization
- [x] OPA Policy-as-Code integration
- [x] Immutable, cryptographically-signed audit trail

**v1.5 — Cloud Integration (In Progress 🔨)**
- [ ] Live AWS account integration via **Boto3** (CloudTrail, GuardDuty, SecurityHub)
- [ ] Slack / Microsoft Teams notification integration
- [ ] JIRA ticket auto-creation for approved incidents

**v2.0 — Advanced Intelligence (Planned 📋)**
- [ ] Fine-tuned local LLM support (**Llama 3**) for air-gapped deployments
- [ ] Advanced Threat Hunting interface with natural language queries
- [ ] MITRE ATT&CK framework automatic tactic/technique mapping
- [ ] Multi-cloud support (GCP, Azure)

---

## 🤝 Contributing

Contributions are welcome! This project is designed to be extended:

1.  **Fork** the repository
2.  **Create** your feature branch:
    ```bash
    git checkout -b feature/your-amazing-feature
    ```
3.  **Commit** your changes:
    ```bash
    git commit -m 'feat: add amazing feature'
    ```
4.  **Push** to your branch:
    ```bash
    git push origin feature/your-amazing-feature
    ```
5.  **Open a Pull Request** against `main`

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for your commit messages and add tests for any new agent logic.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full details.

---

<div align="center">

**Built with obsession for security, AI, and clean architecture.**

*If A-SOC helped you or inspired your work, consider starring ⭐ the repository.*

[![GitHub Stars](https://img.shields.io/github/stars/Ismail-2001/Autonomous-Secure-AI-Operations-Center?style=social)](https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center)

</div>
