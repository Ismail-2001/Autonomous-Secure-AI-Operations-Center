# Security Policy

## Threat Model (STRIDE)

### Spoofing
- **Mitigation**: JWT RS256 asymmetric authentication; token fingerprint binding prevents token theft replay
- **Scope**: All API endpoints, WebSocket connections
- **Residual risk**: Compromised private key (mitigated by key rotation)

### Tampering
- **Mitigation**: HMAC audit trail with blockchain-style chain verification; append-only JSONL storage
- **Scope**: All agent actions, audit entries
- **Residual risk**: Storage-level tampering (mitigated by external log shipping in production)

### Repudiation
- **Mitigation**: Every agent action produces an immutable AuditEntry with cryptographic signature; chain verification detects any deletion or modification
- **Scope**: All 7 agents, API routes
- **Residual risk**: None significant — audit trail is cryptographically tamper-evident

### Information Disclosure
- **Mitigation**: Role-based access control (READONLY/ANALYST/SUPERVISOR/ADMIN); secrets stored in environment variables; API keys use `SecretStr`; prompt injection detection blocks data exfiltration attempts
- **Scope**: All endpoints, agent inputs/outputs
- **Residual risk**: Misconfigured CORS (mitigated by explicit origin whitelist)

### Denial of Service
- **Mitigation**: Per-agent rate limiting (token buckets); IP-level rate limiting; per-endpoint rate limiting; circuit breakers on PostgreSQL and Redis
- **Scope**: All API endpoints, agent execution
- **Residual risk**: Distributed denial of service (requires infrastructure-level mitigation)

### Elevation of Privilege
- **Mitigation**: OPA Rego policies enforce agent-specific permissions; destructive actions (ResponseAgent) require supervisor+ approval; risk score >= 0.95 always denied; RBAC enforced at FastAPI dependency level
- **Scope**: All agent actions, API endpoints
- **Residual risk**: Zero-day in OPA policy engine (mitigated by regular policy updates)

## Attack Surface

### External
- REST API (port 9002)
- WebSocket (port 9002)
- Dashboard (port 3000)
- Docker services (PostgreSQL 5432, Redis 6379, OPA 8181)

### Internal
- Agent execution (PRAO lifecycle)
- LLM provider calls (OpenAI, Anthropic, DeepSeek, Ollama)
- Vector store queries (Pinecone)
- File system (audit log, checkpoint storage)

## Security Controls

### Authentication
- **JWT RS256**: Asymmetric signing (private key signs, public key verifies)
- **Refresh token rotation**: Each use invalidates the old refresh token; reuse detection triggers full user revocation
- **Token fingerprinting**: SHA-256 binding to client identifier prevents token theft
- **API key fallback**: HMAC-compared API keys for service-to-service communication

### Authorization
- **RBAC roles**: READONLY → ANALYST → SUPERVISOR → ADMIN (hierarchical)
- **OPA policies**: Per-agent Rego rules enforce fine-grained permissions
- **Approval gating**: Destructive actions require supervisor+ approval; high-risk actions require explicit authorization
- **Role multipliers**: Rate limits adjusted by privilege level

### Audit
- **HMAC audit trail**: SHA-256 payload hash + HMAC-SHA256 signature + previous entry hash
- **Chain verification**: Blockchain-style integrity check; any tampering detected
- **Append-only storage**: JSONL file (production: database-backed)
- **Key rotation**: Daily HMAC key rotation with configurable schedule

### Input Validation
- **Prompt injection detection**: Pattern-based scanning of all user-controlled strings before LLM calls
- **Threat levels**: NONE/LOW/MEDIUM/HIGH/CRITICAL with automatic blocking
- **Sanitization**: Control character and zero-width Unicode removal
- **Pydantic validation**: All API models enforce type and length constraints

### Rate Limiting
- **Per-agent token buckets**: Tuned by risk level (ResponseAgent: 15/min, TelemetryAgent: 200/min)
- **IP-level limiting**: Per-client IP token bucket
- **Endpoint-level limiting**: Custom limits for high-traffic endpoints
- **Role multipliers**: Admin gets 2x, readonly gets 0.5x

### Network
- **CORS**: Explicit origin whitelist (configurable via `CORS_ORIGINS`)
- **Circuit breakers**: PostgreSQL and Redis with automatic recovery
- **Health checks**: All services with health-based routing

## Key Management

### Development
- Ephemeral RSA keypair auto-generated on startup
- Keys cached in memory (not persisted)
- **WARNING**: Not suitable for production

### Production
- Set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` environment variables
- Use RSA 2048-bit or stronger
- Rotate keys quarterly (or on compromise)
- Store in Vault/KMS (not in `.env` files)

### HMAC Keys
- Set `HMAC_SECRET` environment variable
- Falls back to `WS_API_TOKEN` if not set
- Daily rotation via `_rotate_key()`

## Responsible Disclosure

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email security@asoc-project.example.com (or maintainer's private email)
3. Include: vulnerability description, reproduction steps, potential impact
4. Allow 90 days for remediation before public disclosure
5. Credit will be given in CHANGELOG.md

## Security Checklist (Pre-Production)

- [ ] Set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` (RSA 2048+)
- [ ] Set `HMAC_SECRET` (strong random string)
- [ ] Set `WS_API_TOKEN` (strong random string)
- [ ] Configure `DATABASE_URL` with strong credentials
- [ ] Set `CORS_ORIGINS` to production domain(s)
- [ ] Enable TLS termination (reverse proxy or load balancer)
- [ ] Configure log shipping (audit trail replication)
- [ ] Set up monitoring and alerting for rate limit violations
- [ ] Review OPA policies for custom compliance requirements
- [ ] Run `python -c "from src.asoc.core.config import Settings; warnings = Settings.validate_production(); print('\n'.join(warnings))"` to check configuration
