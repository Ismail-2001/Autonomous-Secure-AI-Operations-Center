"""Seed the database with realistic demo data for all tables."""

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import asyncpg

SEED_INCIDENTS = [
    {
        "incident_number": "INC-2023-882",
        "title": "Unauthorized Login Attempt",
        "description": "Brute force NTLM relay attempt detected on ADM_SRV_WIN_01",
        "severity": "critical",
        "status": "active",
        "source": "EVAL-02-DC",
        "agent": "DetectionAgent",
        "risk_score": 0.92,
        "tags": ["brute-force", "ntlm"],
    },
    {
        "incident_number": "INC-2023-841",
        "title": "Suspicious DNS Tunneling",
        "description": "Beaconing pattern detected from USER_STATION_442",
        "severity": "high",
        "status": "investigating",
        "source": "CORTEX-XDR",
        "agent": "TelemetryAgent",
        "risk_score": 0.78,
        "tags": ["dns-tunnel", "beaconing"],
    },
    {
        "incident_number": "INC-2023-839",
        "title": "IAM Role Modification",
        "description": "IAM role modification detected in S3_BUCKET_PII_PROD",
        "severity": "low",
        "status": "resolved",
        "source": "AWS_CLOUD_TRAIL",
        "agent": "ComplianceAgent",
        "risk_score": 0.35,
        "tags": ["iam", "s3"],
    },
    {
        "incident_number": "INC-2023-870",
        "title": "Ransomware Encryption Detected",
        "description": "High-velocity file encryption on DB server WORKSTATION-205",
        "severity": "critical",
        "status": "active",
        "source": "EDR_SENSOR",
        "agent": "ForensicsAgent",
        "risk_score": 0.95,
        "tags": ["ransomware", "blackcat"],
    },
    {
        "incident_number": "INC-2023-855",
        "title": "Lateral Movement Detected",
        "description": "Pass-the-hash technique used from WORKSTATION-205 to SRV-PROD-DB-01",
        "severity": "high",
        "status": "investigating",
        "source": "NETWORK_SENSOR",
        "agent": "DetectionAgent",
        "risk_score": 0.82,
        "tags": ["lateral-movement", "pth"],
    },
    {
        "incident_number": "INC-2023-830",
        "title": "Suspicious Outbound Traffic",
        "description": "Encrypted tunnel to known C2 server 192.168.10.42",
        "severity": "medium",
        "status": "monitoring",
        "source": "FIREWALL_01",
        "agent": "TelemetryAgent",
        "risk_score": 0.65,
        "tags": ["c2", "exfil"],
    },
    {
        "incident_number": "INC-2023-821",
        "title": "Failed Patch Deployment",
        "description": "Critical patch KB5029244 failed on 12 endpoints",
        "severity": "low",
        "status": "resolved",
        "source": "WSUS_SERVER",
        "agent": "ComplianceAgent",
        "risk_score": 0.25,
        "tags": ["patch", "compliance"],
    },
    {
        "incident_number": "INC-2023-815",
        "title": "Anomalous Data Transfer",
        "description": "5GB data transfer to external IP 203.0.113.42 detected",
        "severity": "high",
        "status": "investigating",
        "source": "DLP_SENSOR",
        "agent": "ResponseAgent",
        "risk_score": 0.75,
        "tags": ["exfil", "data-transfer"],
    },
    {
        "incident_number": "INC-2023-808",
        "title": "Privilege Escalation Attempt",
        "description": "User dev-operator attempted to assume AdminRole",
        "severity": "critical",
        "status": "active",
        "source": "AWS_CLOUD_TRAIL",
        "agent": "DetectionAgent",
        "risk_score": 0.88,
        "tags": ["privilege-escalation", "iam"],
    },
    {
        "incident_number": "INC-2023-801",
        "title": "Malware Quarantine Success",
        "description": "Trojan.GenericKD quarantined on ENDPOINT-042",
        "severity": "medium",
        "status": "resolved",
        "source": "EDR_SENSOR",
        "agent": "ResponseAgent",
        "risk_score": 0.55,
        "tags": ["malware", "quarantine"],
    },
]

SEED_ASSETS = [
    {
        "asset_number": "AST-001",
        "name": "SRV-PROD-DB-01",
        "type": "server",
        "ip_address": "10.0.4.122",
        "os": "LINUX_DEBIAN",
        "status": "online",
        "risk_score": 72.0,
        "vulnerabilities": 5,
        "owner": "SEC_OPS_A",
        "tags": ["LOG4SHELL", "CVE-2023"],
    },
    {
        "asset_number": "AST-002",
        "name": "K8S-NODE-04",
        "type": "container",
        "ip_address": "10.0.12.89",
        "os": "UBUNTU_22",
        "status": "online",
        "risk_score": 12.0,
        "vulnerabilities": 0,
        "owner": "INFRA_TEAM",
        "tags": ["HEALTHY"],
    },
    {
        "asset_number": "AST-003",
        "name": "STATION-100",
        "type": "workstation",
        "ip_address": "192.168.1.10",
        "os": "MACOS_13",
        "status": "online",
        "risk_score": 45.0,
        "vulnerabilities": 2,
        "owner": "USER_ID_441",
        "tags": ["OUTDATED_OS"],
    },
    {
        "asset_number": "AST-004",
        "name": "STATION-101",
        "type": "workstation",
        "ip_address": "192.168.1.11",
        "os": "MACOS_13",
        "status": "online",
        "risk_score": 46.0,
        "vulnerabilities": 2,
        "owner": "USER_ID_442",
        "tags": ["OUTDATED_OS"],
    },
    {
        "asset_number": "AST-005",
        "name": "FW-CORE-01",
        "type": "firewall",
        "ip_address": "10.0.0.1",
        "os": "PANOS_11",
        "status": "online",
        "risk_score": 8.0,
        "vulnerabilities": 0,
        "owner": "NETOPS",
        "tags": ["HARDENED", "FIPS_140"],
    },
    {
        "asset_number": "AST-006",
        "name": "SIEM-COLLECTOR",
        "type": "server",
        "ip_address": "10.0.5.200",
        "os": "RHEL_9",
        "status": "online",
        "risk_score": 15.0,
        "vulnerabilities": 0,
        "owner": "SOC_TEAM",
        "tags": ["HEALTHY"],
    },
    {
        "asset_number": "AST-007",
        "name": "WORKSTATION-205",
        "type": "workstation",
        "ip_address": "192.168.1.205",
        "os": "WIN_11",
        "status": "compromised",
        "risk_score": 89.0,
        "vulnerabilities": 8,
        "owner": "USER_ID_892",
        "tags": ["RANSOMWARE", "ENCRYPTING"],
    },
    {
        "asset_number": "AST-008",
        "name": "BACKUP-SRV-02",
        "type": "server",
        "ip_address": "10.0.6.50",
        "os": "RHEL_9",
        "status": "online",
        "risk_score": 22.0,
        "vulnerabilities": 0,
        "owner": "BACKUP_OPS",
        "tags": ["HEALTHY", "ENCRYPTED"],
    },
    {
        "asset_number": "AST-009",
        "name": "API-GATEWAY-01",
        "type": "container",
        "ip_address": "10.0.3.100",
        "os": "ALPINE_3",
        "status": "online",
        "risk_score": 34.0,
        "vulnerabilities": 1,
        "owner": "NETOPS",
        "tags": ["WAF_ACTIVE"],
    },
    {
        "asset_number": "AST-010",
        "name": "WORKSTATION-310",
        "type": "workstation",
        "ip_address": "192.168.1.310",
        "os": "WIN_11",
        "status": "compromised",
        "risk_score": 67.0,
        "vulnerabilities": 4,
        "owner": "USER_ID_118",
        "tags": ["MALWARE", "C2_DETECTED"],
    },
    {
        "asset_number": "AST-011",
        "name": "MONITORING-STACK",
        "type": "server",
        "ip_address": "10.0.7.200",
        "os": "UBUNTU_22",
        "status": "online",
        "risk_score": 5.0,
        "vulnerabilities": 0,
        "owner": "SOC_TEAM",
        "tags": ["HEALTHY"],
    },
    {
        "asset_number": "AST-012",
        "name": "VPN-GATEWAY-01",
        "type": "server",
        "ip_address": "10.0.0.50",
        "os": "RHEL_9",
        "status": "online",
        "risk_score": 18.0,
        "vulnerabilities": 1,
        "owner": "NETOPS",
        "tags": ["HARDENED"],
    },
]

SEED_FORENSICS = [
    {
        "job_number": "FOR-001",
        "title": "Memory Dump Analysis",
        "status": "completed",
        "evidence_type": "volatile",
        "findings": ["Registry modifications detected", "Encryption artifacts found"],
        "artifacts": ["MEM_DUMP_001.raw"],
        "agent": "ForensicsAgent",
    },
    {
        "job_number": "FOR-002",
        "title": "Network Capture Review",
        "status": "in_progress",
        "evidence_type": "network",
        "findings": ["C2 communication pattern identified"],
        "artifacts": ["NET_CAPTURE_001.pcap"],
        "agent": "ForensicsAgent",
    },
    {
        "job_number": "FOR-003",
        "title": "Disk Image Forensics",
        "status": "pending",
        "evidence_type": "non_volatile",
        "findings": [],
        "artifacts": ["DISK_IMG_001.E01"],
        "agent": "ForensicsAgent",
    },
    {
        "job_number": "FOR-004",
        "title": "Endpoint Telemetry Analysis",
        "status": "completed",
        "evidence_type": "telemetry",
        "findings": ["Process injection detected", "Suspicious scheduled task created"],
        "artifacts": ["TELEM_042.json"],
        "agent": "ForensicsAgent",
    },
    {
        "job_number": "FOR-005",
        "title": "CloudTrail Log Review",
        "status": "completed",
        "evidence_type": "log",
        "findings": ["Privilege escalation attempt confirmed"],
        "artifacts": ["CLOUDTRAIL_001.json"],
        "agent": "ForensicsAgent",
    },
]

SEED_IOC = [
    {
        "indicator_number": "IOC-001",
        "type": "SHA256",
        "value": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "severity": "critical",
        "confidence": 0.98,
        "source": "VirusTotal",
        "tlp": "RED",
        "tags": ["ransomware", "encryptor"],
    },
    {
        "indicator_number": "IOC-002",
        "type": "DOMAIN",
        "value": "sync.bad.ru",
        "severity": "high",
        "confidence": 0.87,
        "source": "OSINT",
        "tlp": "AMBER",
        "tags": ["c2", "beaconing"],
    },
    {
        "indicator_number": "IOC-003",
        "type": "IP",
        "value": "203.0.113.42",
        "severity": "medium",
        "confidence": 0.72,
        "source": "Internal Honeypot",
        "tlp": "GREEN",
        "tags": ["exfil", "scanner"],
    },
    {
        "indicator_number": "IOC-004",
        "type": "DOMAIN",
        "value": "update-helper.xyz",
        "severity": "high",
        "confidence": 0.91,
        "source": "ThreatFox",
        "tlp": "AMBER",
        "tags": ["malware", "dropper"],
    },
    {
        "indicator_number": "IOC-005",
        "type": "IP",
        "value": "185.220.101.34",
        "severity": "critical",
        "confidence": 0.95,
        "source": "AbuseIPDB",
        "tlp": "RED",
        "tags": ["tor-exit", "brute-force"],
    },
    {
        "indicator_number": "IOC-006",
        "type": "SHA256",
        "value": "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
        "severity": "high",
        "confidence": 0.88,
        "source": "MalwareBazaar",
        "tlp": "AMBER",
        "tags": ["trojan", "infostealer"],
    },
    {
        "indicator_number": "IOC-007",
        "type": "URL",
        "value": "https://dl.dropboxusercontent.com/s/x8q/ransomware.dll",
        "severity": "critical",
        "confidence": 0.93,
        "source": "URLhaus",
        "tlp": "RED",
        "tags": ["ransomware", "payload"],
    },
    {
        "indicator_number": "IOC-008",
        "type": "IP",
        "value": "45.33.2.1",
        "severity": "critical",
        "confidence": 0.96,
        "source": "Shodan",
        "tlp": "RED",
        "tags": ["c2", "cobalt-strike"],
    },
]

SEED_COMPLIANCE = [
    {
        "control_id": "CC.1.1.01",
        "framework": "SOC2",
        "name": "Access Control: Role-Based Authorization Policy",
        "description": "Role-based access control policy is enforced across all services",
        "status": "PASS",
    },
    {
        "control_id": "CC.6.1.02",
        "framework": "SOC2",
        "name": "Incident Response: 15min Notification SLA",
        "description": "All critical incidents must trigger notification within 15 minutes",
        "status": "FAIL",
    },
    {
        "control_id": "CC.7.2.01",
        "framework": "SOC2",
        "name": "System Monitoring: Real-time Anomaly Detection",
        "description": "Real-time monitoring and anomaly detection active on all production systems",
        "status": "PASS",
    },
    {
        "control_id": "ISO.27001.A.9",
        "framework": "ISO27001",
        "name": "User Provisioning: Terminated Accounts Revocation",
        "description": "All terminated employee accounts revoked within 24 hours",
        "status": "PASS",
    },
    {
        "control_id": "ISO.27001.A.12",
        "framework": "ISO27001",
        "name": "Cryptographic Controls: Key Management",
        "description": "Cryptographic keys rotated per policy schedule",
        "status": "PASS",
    },
    {
        "control_id": "PCI.DSS.3.1",
        "framework": "PCI_DSS",
        "name": "Vulnerability Mgmt: Bi-weekly Internal Scans",
        "description": "Internal vulnerability scans performed bi-weekly",
        "status": "PENDING",
    },
    {
        "control_id": "HIPAA.164.312",
        "framework": "HIPAA",
        "name": "Encryption: Data at Rest",
        "description": "All PHI encrypted with AES-256 at rest",
        "status": "PASS",
    },
    {
        "control_id": "NIST.CSIR.4",
        "framework": "NIST",
        "name": "Response: Automated Containment",
        "description": "Automated containment actions triggered for high-risk threats",
        "status": "PASS",
    },
    {
        "control_id": "GDPR.ART.33",
        "framework": "GDPR",
        "name": "Breach Notification: 72h Report",
        "description": "Data breaches reported to supervisory authority within 72 hours",
        "status": "PASS",
    },
]


async def seed():
    dsn = os.getenv("DATABASE_URL", "postgresql://asoc_user:changeme123@localhost:5432/asoc_db")
    dsn = dsn.replace("+asyncpg", "")

    conn = await asyncpg.connect(dsn)
    try:
        now = datetime.now(timezone.utc)

        # Seed incidents
        for inc in SEED_INCIDENTS:
            await conn.execute(
                """INSERT INTO incidents (id, incident_number, title, description, severity, status, source, agent, risk_score, tags, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
                   ON CONFLICT (incident_number) DO NOTHING""",
                str(__import__("uuid").uuid4()),
                inc["incident_number"],
                inc["title"],
                inc["description"],
                inc["severity"],
                inc["status"],
                inc["source"],
                inc["agent"],
                inc["risk_score"],
                json.dumps(inc["tags"]),
                now - timedelta(days=len(SEED_INCIDENTS)),
                now,
            )
        print(f"  Seeded {len(SEED_INCIDENTS)} incidents")

        # Seed assets
        for i, ast in enumerate(SEED_ASSETS):
            await conn.execute(
                """INSERT INTO assets (id, asset_number, name, type, ip_address, os, status, risk_score, vulnerabilities, owner, tags, last_scan, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
                   ON CONFLICT (asset_number) DO NOTHING""",
                str(__import__("uuid").uuid4()),
                ast["asset_number"],
                ast["name"],
                ast["type"],
                ast["ip_address"],
                ast["os"],
                ast["status"],
                ast["risk_score"],
                ast["vulnerabilities"],
                ast["owner"],
                json.dumps(ast["tags"]),
                now - timedelta(hours=i),
                now,
            )
        print(f"  Seeded {len(SEED_ASSETS)} assets")

        # Seed forensics jobs
        for i, job in enumerate(SEED_FORENSICS):
            await conn.execute(
                """INSERT INTO forensics_jobs (id, job_number, title, status, evidence_type, findings, artifacts, agent, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
                   ON CONFLICT (job_number) DO NOTHING""",
                str(__import__("uuid").uuid4()),
                job["job_number"],
                job["title"],
                job["status"],
                job["evidence_type"],
                json.dumps(job["findings"]),
                json.dumps(job["artifacts"]),
                job["agent"],
                now - timedelta(days=i),
            )
        print(f"  Seeded {len(SEED_FORENSICS)} forensics jobs")

        # Seed IOC
        for i, ioc in enumerate(SEED_IOC):
            await conn.execute(
                """INSERT INTO threat_indicators (id, indicator_number, type, value, severity, confidence, source, tlp, tags, first_seen, last_seen)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
                   ON CONFLICT (indicator_number) DO NOTHING""",
                str(__import__("uuid").uuid4()),
                ioc["indicator_number"],
                ioc["type"],
                ioc["value"],
                ioc["severity"],
                ioc["confidence"],
                ioc["source"],
                ioc["tlp"],
                json.dumps(ioc["tags"]),
                now - timedelta(days=30 - i),
                now - timedelta(hours=i),
            )
        print(f"  Seeded {len(SEED_IOC)} threat indicators")

        # Seed compliance
        for ctrl in SEED_COMPLIANCE:
            await conn.execute(
                """INSERT INTO compliance_controls (id, control_id, framework, name, description, status, last_checked)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (control_id) DO NOTHING""",
                str(__import__("uuid").uuid4()),
                ctrl["control_id"],
                ctrl["framework"],
                ctrl["name"],
                ctrl["description"],
                ctrl["status"],
                now,
            )
        print(f"  Seeded {len(SEED_COMPLIANCE)} compliance controls")

        # Seed a default user
        await conn.execute(
            """INSERT INTO users (id, user_id, role, client_id, is_active, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id) DO NOTHING""",
            str(__import__("uuid").uuid4()),
            "admin",
            "admin",
            "default",
            True,
            now,
        )
        print("  Seeded default admin user")

        print("\nDatabase seeded successfully!")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
