"""Run migration + seed directly via asyncpg (no Alembic needed)."""

import asyncio
import os
import uuid
from datetime import datetime, timezone

import asyncpg

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://asoc_user:changeme123@postgres:5432/asoc_db").replace(
    "postgresql+asyncpg://", "postgresql://"
)

MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(36) PRIMARY KEY,
    incident_number VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    source VARCHAR(100) NOT NULL DEFAULT 'unknown',
    agent VARCHAR(100) NOT NULL DEFAULT 'DetectionAgent',
    risk_score FLOAT NOT NULL DEFAULT 0.0,
    tags JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_number ON incidents(incident_number);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(36) PRIMARY KEY,
    asset_number VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'server',
    ip_address VARCHAR(45) NOT NULL DEFAULT '',
    os VARCHAR(50) NOT NULL DEFAULT 'unknown',
    status VARCHAR(20) NOT NULL DEFAULT 'online',
    risk_score FLOAT NOT NULL DEFAULT 0.0,
    vulnerabilities INT NOT NULL DEFAULT 0,
    owner VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
    tags JSONB NOT NULL DEFAULT '[]',
    last_scan TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_risk ON assets(risk_score);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);

CREATE TABLE IF NOT EXISTS forensics_jobs (
    id VARCHAR(36) PRIMARY KEY,
    job_number VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    evidence_type VARCHAR(50) NOT NULL DEFAULT 'volatile',
    findings JSONB NOT NULL DEFAULT '[]',
    artifacts JSONB NOT NULL DEFAULT '[]',
    agent VARCHAR(100) NOT NULL DEFAULT 'ForensicsAgent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_forensics_status ON forensics_jobs(status);

CREATE TABLE IF NOT EXISTS threat_indicators (
    id VARCHAR(36) PRIMARY KEY,
    indicator_number VARCHAR(30) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    value VARCHAR(512) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    confidence FLOAT NOT NULL DEFAULT 0.0,
    source VARCHAR(100) NOT NULL DEFAULT 'unknown',
    tlp VARCHAR(10) NOT NULL DEFAULT 'GREEN',
    tags JSONB NOT NULL DEFAULT '[]',
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ioc_type ON threat_indicators(type);
CREATE INDEX IF NOT EXISTS idx_ioc_severity ON threat_indicators(severity);

CREATE TABLE IF NOT EXISTS compliance_controls (
    id VARCHAR(36) PRIMARY KEY,
    control_id VARCHAR(30) NOT NULL UNIQUE,
    framework VARCHAR(30) NOT NULL DEFAULT 'SOC2',
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_framework ON compliance_controls(framework);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'analyst',
    client_id VARCHAR(128) NOT NULL DEFAULT 'default',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_entries (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    signature VARCHAR(128) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_entries(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp);
"""


def uid():
    return str(uuid.uuid4())


async def seed(conn):
    now = datetime.now(timezone.utc)

    # Incidents
    incidents = [
        (
            uid(),
            "INC-2026-0471",
            "Ransomware Lateral Movement Detected",
            "Conti-class ransomware spreading via SMB lateral movement across DMZ segment. Initial vector: compromised VPN credentials.",
            "critical",
            "active",
            "EDR",
            "ResponseAgent",
            94.0,
            '["ransomware","lateral-movement","conti"]',
        ),
        (
            uid(),
            "INC-2026-0470",
            "Privilege Escalation on DC01",
            "Suspicious Kerberoasting activity targeting Domain Controller admin accounts. Service ticket requests spiked 400%.",
            "critical",
            "investigating",
            "SIEM",
            "HuntingAgent",
            88.0,
            '["kerberos","privilege-escalation","domain-controller"]',
        ),
        (
            uid(),
            "INC-2026-0469",
            "Data Exfiltration via DNS Tunneling",
            "Anomalous DNS query volume to known C2 domain. ~2.3GB data transferred over encoded DNS queries in last 4 hours.",
            "high",
            "active",
            "NetworkMonitor",
            "TelemetryAgent",
            79.0,
            '["exfiltration","dns-tunneling","c2"]',
        ),
        (
            uid(),
            "INC-2026-0468",
            "Brute Force Attack on Exchange Server",
            "15,000+ failed OWA login attempts from 3 TOR exit nodes in 30 minutes. 2 accounts locked out.",
            "high",
            "contained",
            "SIEM",
            "TelemetryAgent",
            72.0,
            '["brute-force","exchange","tor"]',
        ),
        (
            uid(),
            "INC-2026-0467",
            "Suspicious PowerShell Execution",
            "Encoded PowerShell command executed on WRK-0451 connecting to external IP on port 443.",
            "medium",
            "investigating",
            "EDR",
            "HuntingAgent",
            58.0,
            '["powershell","encoded-command","suspicious-process"]',
        ),
        (
            uid(),
            "INC-2026-0466",
            "Unauthorized S3 Bucket Access",
            "IAM role AssumeRole from unfamiliar IP accessed production S3 bucket. No data downloaded.",
            "medium",
            "monitoring",
            "CloudTrail",
            "ResponseAgent",
            45.0,
            '["aws","s3","unauthorized-access"]',
        ),
        (
            uid(),
            "INC-2026-0465",
            "Phishing Campaign - HR Department",
            "Multiple HR staff clicked credential harvesting link. 3 accounts potentially compromised.",
            "high",
            "active",
            "EmailGateway",
            "ResponseAgent",
            76.0,
            '["phishing","credential-harvest","hr-department"]',
        ),
        (
            uid(),
            "INC-2026-0464",
            "Container Escape Attempt",
            "Suspicious syscalls detected in production k8s pod attempting namespace escape.",
            "critical",
            "active",
            "Falco",
            "ResponseAgent",
            91.0,
            '["kubernetes","container-escape","syscalls"]',
        ),
        (
            uid(),
            "INC-2026-0463",
            "Anomalous Database Query Pattern",
            "Unusual bulk SELECT queries on customer PII table outside business hours.",
            "medium",
            "investigating",
            "DatabaseMonitor",
            "HuntingAgent",
            52.0,
            '["database","pii","anomalous-query"]',
        ),
        (
            uid(),
            "INC-2026-0462",
            "TLS Certificate Anomaly",
            "Self-signed certificate detected on internal service impersonating corporate CA.",
            "low",
            "open",
            "CertificateMonitor",
            "TelemetryAgent",
            30.0,
            '["certificate","tls","impersonation"]',
        ),
    ]
    await conn.executemany(
        "INSERT INTO incidents (id,incident_number,title,description,severity,status,source,agent,risk_score,tags,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) ON CONFLICT DO NOTHING",
        [(i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7], i[8], i[9], now, now) for i in incidents],
    )

    # Assets
    assets = [
        (
            uid(),
            "AST-001",
            "Production Database Cluster",
            "database",
            "10.0.1.10",
            "Ubuntu 22.04 LTS",
            "online",
            28.0,
            0,
            "DBA Team",
            '["production","critical"]',
            now,
        ),
        (
            uid(),
            "AST-002",
            "DMZ Web Server 01",
            "server",
            "10.0.0.5",
            "Ubuntu 22.04 LTS",
            "online",
            15.0,
            1,
            "WebOps",
            '["dmz","public-facing"]',
            now,
        ),
        (
            uid(),
            "AST-003",
            "Core Router - HQ",
            "network",
            "10.0.0.1",
            "Cisco IOS XE 17.6",
            "online",
            8.0,
            0,
            "NetworkOps",
            '["core","hq"]',
            now,
        ),
        (
            uid(),
            "AST-004",
            "Employee Workstation - J. Smith",
            "workstation",
            "10.0.2.50",
            "Windows 11 23H2",
            "online",
            42.0,
            3,
            "IT Support",
            '["endpoint","high-value"]',
            now,
        ),
        (
            uid(),
            "AST-005",
            "Kubernetes Worker Node 03",
            "server",
            "10.0.1.30",
            "Ubuntu 22.04 LTS",
            "online",
            35.0,
            2,
            "PlatformTeam",
            '["kubernetes","production"]',
            now,
        ),
        (
            uid(),
            "AST-006",
            "VPN Gateway",
            "network",
            "203.0.113.5",
            "FortiOS 7.4",
            "degraded",
            55.0,
            1,
            "NetworkOps",
            '["vpn","critical","dmz"]',
            now,
        ),
        (
            uid(),
            "AST-007",
            "File Server - Finance",
            "server",
            "10.0.3.10",
            "Windows Server 2022",
            "online",
            12.0,
            0,
            "IT Support",
            '["fileserver","finance"]',
            now,
        ),
        (
            uid(),
            "AST-008",
            "CI/CD Jenkins Server",
            "server",
            "10.0.1.50",
            "Ubuntu 22.04 LTS",
            "online",
            22.0,
            1,
            "DevOps",
            '["cicd","jenkins"]',
            now,
        ),
        (
            uid(),
            "AST-009",
            "SIEM Collector Node",
            "server",
            "10.0.0.20",
            "Ubuntu 22.04 LTS",
            "online",
            5.0,
            0,
            "SecOps",
            '["siem","monitoring"]',
            now,
        ),
        (
            uid(),
            "AST-010",
            "Employee Laptop - A. Patel",
            "workstation",
            "10.0.2.78",
            "macOS 14 Sonoma",
            "offline",
            18.0,
            0,
            "IT Support",
            '["endpoint","remote"]',
            now,
        ),
        (
            uid(),
            "AST-011",
            "Active Directory DC01",
            "server",
            "10.0.0.10",
            "Windows Server 2022",
            "online",
            20.0,
            0,
            "IdentityTeam",
            '["ad","domain-controller","critical"]',
            now,
        ),
        (
            uid(),
            "AST-012",
            "Backup Storage Array",
            "storage",
            "10.0.1.80",
            "Data ONTAP 9.12",
            "online",
            10.0,
            0,
            "DBA Team",
            '["backup","storage"]',
            now,
        ),
    ]
    await conn.executemany(
        "INSERT INTO assets (id,asset_number,name,type,ip_address,os,status,risk_score,vulnerabilities,owner,tags,last_scan,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$12) ON CONFLICT DO NOTHING",
        [(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11]) for a in assets],
    )

    # Forensics jobs
    jobs = [
        (
            uid(),
            "FRN-2026-0042",
            "Ransomware Memory Analysis",
            "completed",
            "volatile",
            '["Encrypted files identified","Conti ransomware variant","Initial access via RDP brute force"]',
            '["memory_dump.raw","disk_image.E01"]',
            "ForensicsAgent",
            now,
            now,
        ),
        (
            uid(),
            "FRN-2026-0041",
            "Exfiltrated Data Packet Capture",
            "completed",
            "network",
            '["DNS tunneling confirmed","2.3GB data exfiltrated via dns.example.com","Data includes PII records"]',
            '["capture.pcap","dns_queries.log"]',
            "ForensicsAgent",
            now,
            now,
        ),
        (
            uid(),
            "FRN-2026-0040",
            "Phishing Email Artifact Analysis",
            "in-progress",
            "email",
            '["Credential harvesting URL identified","Malicious macro in attachment","3 users clicked link"]',
            '["email_sample.eml","extracted_macro.ps1"]',
            "ForensicsAgent",
            now,
            None,
        ),
        (
            uid(),
            "FRN-2026-0039",
            "Container Escape Forensics",
            "in-progress",
            "volatile",
            '["Suspicious syscall pattern detected","Namespace isolation bypass attempted","Kubernetes audit log correlation pending"]',
            '["pod_logs.txt","syscall_trace.bin"]',
            "ForensicsAgent",
            now,
            None,
        ),
        (
            uid(),
            "FRN-2026-0038",
            "Database Query Forensics",
            "pending",
            "log",
            '["Awaiting log collection from production DB cluster","Focus: bulk SELECT on customer_pii table"]',
            "[]",
            "ForensicsAgent",
            now,
            None,
        ),
    ]
    await conn.executemany(
        "INSERT INTO forensics_jobs (id,job_number,title,status,evidence_type,findings,artifacts,agent,created_at,completed_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10) ON CONFLICT DO NOTHING",
        [(j[0], j[1], j[2], j[3], j[4], j[5], j[6], j[7], j[8], j[9]) for j in jobs],
    )

    # Threat indicators
    iocs = [
        (
            uid(),
            "IOC-2026-0142",
            "ip",
            "185.220.101.45",
            "critical",
            0.95,
            "ThreatFox",
            "RED",
            '["c2","ransomware"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0141",
            "domain",
            "update-service-cdn[.]com",
            "critical",
            0.92,
            "VirusTotal",
            "RED",
            '["c2","malware"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0140",
            "hash",
            "a3f2b8c...d4e5f6",
            "high",
            0.88,
            "HybridAnalysis",
            "AMBER",
            '["malware","conti"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0139",
            "url",
            "https://docs-api[.]xyz/login",
            "high",
            0.85,
            "PhishTank",
            "RED",
            '["phishing","credential-theft"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0138",
            "ip",
            "103.42.18.77",
            "high",
            0.82,
            "AbuseIPDB",
            "AMBER",
            '["scanner","brute-force"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0137",
            "email",
            "hr-dept-urgent@mailserver365[.]com",
            "medium",
            0.78,
            "PhishTank",
            "AMBER",
            '["phishing","spear-phishing"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0136",
            "hash",
            "b7e2c3d...f1a9e8",
            "medium",
            0.72,
            "VirusTotal",
            "GREEN",
            '["suspicious","encoded-ps"]',
            now,
            now,
        ),
        (
            uid(),
            "IOC-2026-0135",
            "domain",
            "vpn-update-secure[.]net",
            "low",
            0.45,
            "OSINT",
            "GREEN",
            '["suspicious","dns"]',
            now,
            now,
        ),
    ]
    await conn.executemany(
        "INSERT INTO threat_indicators (id,indicator_number,type,value,severity,confidence,source,tlp,tags,first_seen,last_seen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) ON CONFLICT DO NOTHING",
        [(i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7], i[8], i[9], i[10]) for i in iocs],
    )

    # Compliance controls
    controls = [
        (
            uid(),
            "CC6.1",
            "SOC2",
            "Logical Access Controls",
            "Role-based access control enforced across all production systems with MFA.",
            "PASS",
            now,
        ),
        (
            uid(),
            "CC6.6",
            "SOC2",
            "Boundary Protection",
            "Network segmentation verified. Firewall rules reviewed quarterly.",
            "PASS",
            now,
        ),
        (
            uid(),
            "CC7.1",
            "SOC2",
            "Vulnerability Management",
            "Monthly vulnerability scanning with 30-day remediation SLA.",
            "FAIL",
            now,
        ),
        (
            uid(),
            "CC7.2",
            "SOC2",
            "Monitoring & Detection",
            "SIEM deployed with 24/7 SOC coverage. Mean detection time: 12 minutes.",
            "PASS",
            now,
        ),
        (
            uid(),
            "CC8.1",
            "SOC2",
            "Change Management",
            "All production changes require peer review and automated testing.",
            "PASS",
            now,
        ),
        (
            uid(),
            "A.12.1.1",
            "ISO27001",
            "Documented Operating Procedures",
            "IT operations procedures documented and reviewed annually.",
            "PASS",
            now,
        ),
        (
            uid(),
            "A.12.1.2",
            "ISO27001",
            "Change Management",
            "Formal change management process with CAB approval.",
            "PASS",
            now,
        ),
        (
            uid(),
            "A.12.4.1",
            "ISO27001",
            "Event Logging",
            "Audit logs retained for 12 months. Tamper-evident storage.",
            "PASS",
            now,
        ),
        (
            uid(),
            "A.14.2.1",
            "ISO27001",
            "Secure Development Policy",
            "SDLC with mandatory security reviews at each phase.",
            "FAIL",
            now,
        ),
    ]
    await conn.executemany(
        "INSERT INTO compliance_controls (id,control_id,framework,name,description,status,last_checked) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
        [(c[0], c[1], c[2], c[3], c[4], c[5], c[6]) for c in controls],
    )

    # Admin user
    await conn.execute(
        "INSERT INTO users (id,user_id,role,client_id,is_active,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        uid(),
        "admin@asoc.local",
        "admin",
        "default",
        True,
        now,
    )

    print("Seed data inserted successfully!")


async def main():
    conn = await asyncpg.connect(DATABASE_URL)

    # Check what tables exist
    tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    existing = {r["table_name"] for r in tables}
    print(f"Existing tables: {existing}")

    target = {
        "incidents",
        "assets",
        "forensics_jobs",
        "threat_indicators",
        "compliance_controls",
        "users",
        "audit_entries",
    }
    missing = target - existing

    if missing:
        print(f"Missing tables: {missing}. Running migration...")
        await conn.execute(MIGRATION_SQL)
        print("Migration complete!")
    else:
        print("All tables exist.")

    # Check if seed data exists
    count = await conn.fetchval("SELECT COUNT(*) FROM incidents")
    if count == 0:
        await seed(conn)
    else:
        print(f"Already have {count} incidents. Skipping seed.")

    # Verify
    for t in ["incidents", "assets", "forensics_jobs", "threat_indicators", "compliance_controls"]:
        c = await conn.fetchval(f"SELECT COUNT(*) FROM {t}")
        print(f"  {t}: {c} rows")

    await conn.close()


asyncio.run(main())
