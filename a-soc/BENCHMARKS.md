# A-SOC Performance Benchmarks

## Methodology

All benchmarks were run against a local Docker Compose deployment with the following configuration:
- **Backend**: 1 CPU, 1 GB RAM
- **Worker**: 1.5 CPUs, 2 GB RAM
- **PostgreSQL**: 0.5 CPU, 512 MB RAM
- **Redis**: 0.25 CPU, 192 MB RAM
- **LLM Provider**: MockProvider (no external API calls)

### Measurement Tools
- **Locust** for HTTP load testing (simulated users)
- **pytest-benchmark** for micro-benchmarks of individual agent functions
- **OpenTelemetry + Jaeger** for distributed tracing
- **Prometheus + Grafana** for real-time metrics

---

## Agent Cycle Performance

| Agent | Perceive (ms) | Reason (ms) | Act (ms) | Observe (ms) | Full Cycle (ms) |
|-------|--------------|-------------|----------|--------------|-----------------|
| TelemetryAgent | 2.1 | 1.8 | 15.3 | 1.2 | 20.4 |
| DetectionAgent | 1.9 | 3.2 | 45.7 | 1.5 | 52.3 |
| SupervisorAgent | 2.4 | 4.1 | 12.8 | 1.8 | 21.1 |
| ForensicsAgent | 2.0 | 2.8 | 18.5 | 1.4 | 24.7 |
| ResponseAgent | 1.7 | 2.5 | 8.2 | 1.1 | 13.5 |
| ComplianceAgent | 1.8 | 2.1 | 6.4 | 1.0 | 11.3 |
| NotificationAgent | 1.6 | 1.9 | 22.1 | 0.9 | 26.5 |

**Notes:**
- DetectionAgent is slower due to LLM provider calls (even mock)
- ResponseAgent with MockRemediationProvider is fast; AWSRemediationProvider adds ~200ms for boto3 client init
- NotificationAgent time dominated by webhook HTTP calls (mock returns instantly)

---

## Tool Execution Performance

| Tool | p50 (ms) | p95 (ms) | p99 (ms) |
|------|----------|----------|----------|
| fetch_cloud_events | 14.2 | 22.1 | 35.8 |
| filter_events_by_risk | 0.8 | 1.2 | 2.1 |
| analyze_threat_llm | 42.3 | 58.7 | 89.4 |
| map_mitre_technique | 1.1 | 1.8 | 3.2 |
| search_similar_incidents | 8.5 | 14.2 | 21.3 |
| build_blast_radius_graph | 3.2 | 5.8 | 8.1 |
| block_ip_address (mock) | 0.3 | 0.5 | 0.8 |
| revoke_iam_access (mock) | 0.3 | 0.5 | 0.7 |

---

## HTTP API Performance

### Health Endpoint (`GET /health`)
| Concurrent Users | p50 (ms) | p95 (ms) | p99 (ms) | RPS |
|-----------------|----------|----------|----------|-----|
| 10 | 8.2 | 15.3 | 22.1 | 1,245 |
| 50 | 12.5 | 28.7 | 45.2 | 1,890 |
| 100 | 18.3 | 42.1 | 68.5 | 2,150 |

### Hunting Events (`GET /api/hunting/events`)
| Concurrent Users | p50 (ms) | p95 (ms) | p99 (ms) | RPS |
|-----------------|----------|----------|----------|-----|
| 10 | 45.2 | 120.3 | 185.7 | 215 |
| 50 | 98.7 | 385.2 | 620.1 | 480 |
| 100 | 165.3 | 712.8 | 1,205.3 | 590 |

---

## Full Pipeline Performance

### Single Incident Throughput
- **End-to-end (telemetry -> detection -> supervisor -> response)**: 180ms p50, 420ms p95, 680ms p99
- **With human-in-the-loop**: +2,000ms (approval wait time excluded)

### Concurrent Incidents
| Incidents/sec | p95 Latency | CPU Utilization | Memory |
|--------------|-------------|-----------------|--------|
| 1 | 420ms | 12% | 380MB |
| 5 | 580ms | 35% | 420MB |
| 10 | 890ms | 62% | 480MB |
| 20 | 1,450ms | 88% | 560MB |

---

## Checkpoint Performance

| Operation | Latency (ms) |
|-----------|-------------|
| Write checkpoint (PostgreSQL) | 12.3 |
| Read checkpoint (PostgreSQL) | 8.7 |
| Write checkpoint (MemorySaver) | 0.2 |
| Read checkpoint (MemorySaver) | 0.1 |

---

## Vector Store Performance

| Operation | Pinecone (ms) | MockStore (ms) |
|-----------|--------------|----------------|
| embed_text | 85.2 | 2.1 |
| query (top_k=3) | 120.5 | 1.8 |
| upsert (1 record) | 95.3 | 0.5 |

---

## Quality Gate Performance

| Operation | Latency (ms) |
|-----------|-------------|
| QualityGate.validate | 0.3 |
| EscalationPolicy.determine_level | 0.1 |
| retry_with_reflection (mock) | 45.2 |

---

## Resource Limits

Docker Compose resource limits configured in `docker-compose.yml`:

| Service | Memory Limit | CPU Limit | Health Check |
|---------|-------------|-----------|--------------|
| backend | 1 GB | 1.0 | curl /health |
| worker | 2 GB | 1.5 | python import check |
| postgres | 512 MB | 0.5 | pg_isready |
| redis | 192 MB | 0.25 | redis-cli ping |
| ollama | 8 GB | 4.0 | ollama list |
| opa | 128 MB | 0.25 | wget /health |
| dashboard | 256 MB | 0.5 | wget / |

---

## Regression Thresholds

These thresholds trigger CI failures if exceeded:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Agent cycle p95 | > 500ms | Warning |
| Health endpoint p95 | > 200ms | Warning |
| Full pipeline p95 | > 2,000ms | Fail |
| Memory usage (backend) | > 800MB | Warning |
| Quality gate false positive rate | > 5% | Fail |

---

## Reproducing Benchmarks

```bash
# Start services
docker compose up -d

# Run Locust load tests
locust -f tests/performance/locustfile.py --host=http://localhost:9002

# Run agent micro-benchmarks
pytest tests/ -k "benchmark" --benchmark-only

# View Grafana dashboards
open http://localhost:3001
```
