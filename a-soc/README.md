# Autonomous Secure AI Operations Center (A-SOC) 🛡️

![A-SOC Dashboard](https://github.com/user-attachments/assets/placeholder-dashboard.png)

## 📌 Project Overview

**Autonomous Secure AI Operations Center (A-SOC)** is a next-generation security platform that leverages **Agentic AI** to autonomously detect, investigate, and remediate threats in cloud environments. Unlike traditional SIEMs that rely on static rules, A-SOC uses a **Multi-Agent Architecture** powered by LLMs to reason about security events, calculate risk scores, and execute defensive actions with **Human-in-the-Loop** governance.

Designed for modern DevSecOps teams, A-SOC provides real-time visibility into your security posture, visualizing attack paths (Blast Radius) and enforcing rigorous compliance guardrails automatically.

---

## 🚀 Key Features

*   **🕵️‍♂️ Multi-Agent Architecture**: Specialized agents for Telemetry, Detection, Forensics, Response, and Compliance working in concert.
*   **🧠 LLM-Powered Analysis**: Uses advanced Large Language Models to contextualize alerts and reduce false positives.
*   **⚡ Real-Time Threat Streaming**: WebSocket-based event feed delivering live updates to the dashboard.
*   **🛑 Human-in-the-Loop Governance**: High-risk actions (e.g., IAM revocation) require explicit human approval via a secure modal.
*   **🕸️ Blast Radius Visualization**: Interactive graph visualization of the attack path and affected resources.
*   **📜 Immutable Audit Trail**: All actions and decisions are cryptographically logged for compliance (SOC2/ISO 27001).
*   **👮 Policy-as-Code**: Integrated Open Policy Agent (OPA) for determining authorized actions based on risk scores.
*   **🎨 Premium Dashboard**: A cinematic, glassmorphism UI built with Next.js and Tailwind CSS.

---

## 🛠️ Tech Stack

### **Backend (Python)**
*   **Framework**: FastAPI (Async API & WebSockets)
*   **Orchestration**: LangGraph (Agent State Machine)
*   **AI/LLM**: OpenAI / Anthropic / DeepSeek (via LangChain)
*   **Policy Engine**: Open Policy Agent (OPA) & Rego
*   **Database**: PostgreSQL & Redis (for state persistence)
*   **Infrastructure**: Docker & Docker Compose

### **Frontend (TypeScript)**
*   **Framework**: Next.js 14 (App Router)
*   **Styling**: Tailwind CSS & Lucide React
*   **Visualization**: Custom SVG / React Flow
*   **State Management**: React Hooks & WebSockets

---

## 🏗️ Architecture

The system operates on a **Hub-and-Spoke** agent model orchestrated by a Supervisor:

1.  **Telemetry Agent**: Ingests logs (CloudTrail, VPC Flow Logs, K8s Audit).
2.  **Detection Agent**: Analyzes logs for anomalies and assigns a Risk Score (0-100).
3.  **Supervisor Agent**: Evaluates the risk against OPA policies.
    *   *Low Risk* -> Auto-remediate.
    *   *High Risk* -> Request Human Approval.
4.  **Forensics Agent**: Investigates the blast radius and constructs the attack graph.
5.  **Response Agent**: Executes the remediation (e.g., block IP, revoke keys).
6.  **Compliance Agent**: Maps the incident to control frameworks and logs evidence.

---

## ⚙️ Installation & Setup

### **Prerequisites**
*   Python 3.10+
*   Node.js 18+
*   Docker & Docker Compose (optional but recommended)
*   API Key for OpenAI/Anthropic

### **1. Clone the Repository**
```bash
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center-2.git
cd Autonomous-Secure-AI-Operations-Center-2/a-soc
```

### **2. Backend Setup**
Create visual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Configure Environment Variables:
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

Run the Backend:
```bash
# This starts the API Server on port 9001
python -m uvicorn api:app --host 0.0.0.0 --port 9001 --reload
```

### **3. Frontend Setup**
Navigate to the dashboard directory:
```bash
cd dashboard
npm install
npm run dev
```
Access the dashboard at `http://localhost:3000`.

---

## 🎮 Usage

1.  **Start the System**: Ensure both backend (port 9001) and frontend (port 3000) are running.
2.  **Open Dashboard**: Go to `http://localhost:3000`.
3.  **Run Simulation**: Click the **"Start Simulation"** button in the top right.
4.  **Monitor**: Watch the agent logs stream in real-time.
5.  **Approve Action**: When the **"High Risk Action Proposed"** modal appears, review the Blast Radius graph and click **"Authorize"** to neutralize the threat.

---

## 🚢 Deployment

### Quick Start with Docker Compose

```bash
# Clone the repository
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center-2.git
cd Autonomous-Secure-AI-Operations-Center-2/a-soc

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Launch the entire stack
docker-compose up -d
```

Access the dashboard at `http://localhost:3000`

### Production Deployment

For detailed deployment instructions including:
- **AWS ECS** deployment
- **Kubernetes** manifests
- **Vercel** frontend deployment
- **Monitoring & Scaling**
- **Security hardening**

See the comprehensive [**DEPLOYMENT.md**](./DEPLOYMENT.md) guide.

### Cloud Platforms

| Platform | Backend | Frontend | Guide |
|----------|---------|----------|-------|
| **AWS ECS** | ✅ Fargate | ✅ S3+CloudFront | [DEPLOYMENT.md](./DEPLOYMENT.md#aws-ecs-deployment) |
| **Kubernetes** | ✅ Any K8s | ✅ Ingress | [k8s/](./k8s/) |
| **Docker** | ✅ Compose | ✅ Compose | `docker-compose up` |
| **Vercel** | ❌ | ✅ Serverless | [DEPLOYMENT.md](./DEPLOYMENT.md#vercel-dashboard-only) |

---

## 🗺️ Roadmap

*   [x] Core Multi-Agent Loop
*   [x] Real-time WebSocket Feed
*   [x] Human-in-the-Loop Approval Workflow
*   [x] Blast Radius Visualization
*   [ ] Integration with real AWS Accounts (Boto3)
*   [ ] Slack/Teams Notification Integration
*   [ ] Fine-tuned local LLM support (Llama 3)
*   [ ] Advanced Threat Hunting interface

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
