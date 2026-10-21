# A-SOC Deployment Guide 🚀

## Quick Start (Docker Compose)

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- OpenAI/Anthropic API Key

### 1. Clone & Configure

```bash
git clone https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center-2.git
cd Autonomous-Secure-AI-Operations-Center-2/a-soc
cp .env.example .env
```

Edit `.env` and add your API keys:
```bash
OPENAI_API_KEY=sk-...
POSTGRES_PASSWORD=your_secure_password
```

### 2. Launch the Stack

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **OPA** (port 8181)
- **Backend API** (port 9002)
- **Dashboard** (port 3000)

### 3. Access the Dashboard

Open your browser to:
```
http://localhost:3000
```

Click **"Start Simulation"** to see the A-SOC in action!

---

## Production Deployment

### AWS ECS Deployment

1. **Build and Push Images**
```bash
# Backend
docker build -t asoc-backend:latest .
docker tag asoc-backend:latest YOUR_ECR_REPO/asoc-backend:latest
docker push YOUR_ECR_REPO/asoc-backend:latest

# Dashboard
cd dashboard
docker build -t asoc-dashboard:latest .
docker tag asoc-dashboard:latest YOUR_ECR_REPO/asoc-dashboard:latest
docker push YOUR_ECR_REPO/asoc-dashboard:latest
```

2. **Create ECS Task Definition**
Use the provided `ecs-task-definition.json` template.

3. **Deploy Service**
```bash
aws ecs create-service \
  --cluster asoc-cluster \
  --service-name asoc-service \
  --task-definition asoc-task \
  --desired-count 2 \
  --launch-type FARGATE
```

### Hetzner Cloud CPX31 Deployment (~€13.50/mo)

The system is optimized to run comfortably on a single Hetzner CPX31 VPS (4 vCPU, 8 GB RAM, 160 GB NVMe SSD) using external Cloud LLMs (Groq / DeepSeek / OpenAI):

#### Resource Allocation Profile:
| Service | CPU Limit | Memory Limit | Notes |
|---------|-----------|--------------|-------|
| Caddy Reverse Proxy | 0.25 vCPU | 128 MB | Automated Let's Encrypt TLS & WSS proxying |
| Backend API | 1.0 vCPU | 1024 MB | FastAPI, async connection pool (min 2, max 10) |
| Async Worker (2 Replicas) | 2.0 vCPU | 1536 MB (2x 768M) | `SELECT FOR UPDATE SKIP LOCKED` pipeline |
| Dashboard UI | 0.5 vCPU | 384 MB | Next.js production SSR bundle |
| Redis 7 Alpine | 0.25 vCPU | 160 MB | Auth tokens, rate limiting, and distributed cache |
| OPA Policy Engine | 0.25 vCPU | 128 MB | In-memory guardrails evaluation |
| **Total Allocation** | **4.25 vCPU burst** | **~3.3 GB RAM** | **~4.7 GB RAM headroom for OS & caching** |

#### Option A: 1-Click Production Docker Compose
```bash
# 1. Copy production compose configuration
cp docker-compose.prod.yml docker-compose.yml

# 2. Configure environment with your domain & secrets
export DOMAIN=asoc.yourdomain.com
export DATABASE_URL="postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/asoc?sslmode=require"
export REDIS_PASSWORD="generate-secure-redis-pass"
export HMAC_SECRET="generate-64-byte-hmac-key"
export JWT_SECRET_KEY="generate-64-byte-jwt-key"
export ADMIN_PASSWORD="your-strong-admin-pass"
export GROQ_API_KEY="gsk_..."

# 3. Start production stack with automated TLS
docker compose -f docker-compose.prod.yml up -d
```

#### Option B: Hetzner k3s Automated Bootstrap
```bash
# Make script executable and run with your domain & ACME email
chmod +x k8s/k3s-hetzner-deploy.sh
./k8s/k3s-hetzner-deploy.sh asoc.yourdomain.com security@yourdomain.com
```

### Kubernetes Deployment (Standard / Multi-node)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/opa.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/worker.yaml
kubectl apply -f k8s/dashboard.yaml
kubectl apply -f k8s/ingress.yaml
```

### Vercel (Dashboard Only)

```bash
cd dashboard
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`: Your backend URL
- `NEXT_PUBLIC_WS_URL`: Your WebSocket URL

---

## Environment Variables

### Required
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: LLM provider
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

### Optional
- `SLACK_WEBHOOK_URL`: For real Slack notifications
- `AWS_ACCESS_KEY_ID`: For real AWS integrations
- `AWS_SECRET_ACCESS_KEY`: For real AWS integrations
- `OPA_URL`: Open Policy Agent endpoint (default: http://localhost:8181)

---

## Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Health Checks
- Backend: `http://localhost:9002/health`
- OPA: `http://localhost:8181/health`
- PostgreSQL: `docker-compose exec postgres pg_isready`

---

## Scaling

### Horizontal Scaling (Docker Compose)
```bash
docker-compose up -d --scale backend=3
```

### Kubernetes Autoscaling
```bash
kubectl autoscale deployment asoc-backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

---

## Backup & Recovery

### Database Backup
```bash
docker-compose exec postgres pg_dump -U asoc_user asoc_db > backup.sql
```

### Restore
```bash
docker-compose exec -T postgres psql -U asoc_user asoc_db < backup.sql
```

---

## Troubleshooting

### Backend won't start
- Check API keys in `.env`
- Verify PostgreSQL is healthy: `docker-compose ps`
- Check logs: `docker-compose logs backend`

### Dashboard connection issues
- Ensure backend is running on port 9002
- Check CORS settings in `api.py`
- Verify WebSocket connection in browser console

### OPA policy errors
- Validate Rego syntax: `opa test guardrails/policies/`
- Check OPA logs: `docker-compose logs opa`

---

## Security Best Practices

1. **Change default passwords** in `.env`
2. **Use secrets management** (AWS Secrets Manager, Vault)
3. **Enable HTTPS** with reverse proxy (Nginx, Traefik)
4. **Restrict network access** with firewall rules
5. **Regular updates** of Docker images
6. **Audit logs** stored in immutable storage (S3, CloudWatch)

---

## Performance Tuning

### Backend
- Increase worker count: `--workers 4` in uvicorn command
- Enable connection pooling in PostgreSQL
- Use Redis for caching LLM responses

### Database
```sql
-- Optimize queries
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_incidents_correlation_id ON incidents(correlation_id);
```

---

## Support

- **Issues**: https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center-2/issues
- **Discussions**: https://github.com/Ismail-2001/Autonomous-Secure-AI-Operations-Center-2/discussions
