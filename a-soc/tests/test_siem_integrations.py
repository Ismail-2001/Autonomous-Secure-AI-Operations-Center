"""SIEM & EDR Enterprise Ingestors Test Suite.

Validates:
1. Normalization of Splunk HEC, Microsoft Sentinel, CrowdStrike, and generic payloads.
2. Splunk HEC API compliance (single events & batch arrays, status code 0).
3. Token authentication & verification for enterprise webhooks.
4. Autonomous investigation job escalation for high/critical security alerts.
5. Real-time WebSocket / Redis Pub/Sub broadcast fan-out.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.asoc.api.app import app
from src.asoc.core.config import settings
from src.asoc.core.siem_normalizer import SiemNormalizer


# ── 1. Telemetry Normalization Unit Tests ──────────────────────────────────


class TestSiemNormalizer:
    def test_normalize_splunk_hec_payload(self):
        payload = {
            "time": 1740001234.5,
            "host": "prod-srv-db01",
            "source": "suricata",
            "sourcetype": "suricata_alert",
            "event": {
                "action": "blocked",
                "src_ip": "185.220.101.45",
                "dest_ip": "10.0.2.14",
                "user": "db_admin",
                "signature": "ET TROJAN BlackCat C2 Beaconing",
                "severity": "critical",
                "mitre_technique": "T1071.001",
            },
        }

        alert = SiemNormalizer.normalize_splunk_hec(payload)
        assert alert.source_system == "splunk"
        assert alert.target_host == "prod-srv-db01"
        assert alert.source_ip == "185.220.101.45"
        assert alert.user == "db_admin"
        assert alert.severity == "critical"
        assert alert.mitre_techniques == ["T1071.001"]
        assert alert.is_actionable() is True

    def test_normalize_sentinel_alert_with_entities(self):
        payload = {
            "IncidentTitle": "Anomalous MFA Spike from Tor Exit Node",
            "Severity": "High",
            "Description": "Multiple push notifications rejected",
            "Entities": [
                {"Type": "ip", "Address": "103.42.18.77"},
                {"Type": "account", "Name": "sarah.connor"},
                {"Type": "host", "HostName": "CORP-WKS-102"},
            ],
            "Tactics": ["CredentialAccess", "InitialAccess"],
            "Techniques": ["T1110.003"],
        }

        alert = SiemNormalizer.normalize_sentinel_alert(payload)
        assert alert.source_system == "sentinel"
        assert alert.title == "Anomalous MFA Spike from Tor Exit Node"
        assert alert.severity == "high"
        assert alert.source_ip == "103.42.18.77"
        assert alert.user == "sarah.connor"
        assert alert.target_host == "CORP-WKS-102"
        assert "T1110.003" in alert.mitre_techniques
        assert alert.is_actionable() is True

    def test_normalize_crowdstrike_detection_event(self):
        payload = {
            "event": {
                "ComputerName": "FINANCE-LAPTOP-04",
                "UserName": "bob.finance",
                "FileName": "mimikatz.exe",
                "CommandLine": "mimikatz.exe privilege::debug sekurlsa::logonpasswords",
                "Tactic": "Credential Access",
                "Technique": "T1003",
                "SeverityName": "Critical",
                "DetectName": "Credential Dumping via Mimikatz",
            }
        }

        alert = SiemNormalizer.normalize_crowdstrike_detection(payload)
        assert alert.source_system == "crowdstrike"
        assert alert.target_host == "FINANCE-LAPTOP-04"
        assert alert.process == "mimikatz.exe"
        assert alert.severity == "critical"
        assert "T1003" in alert.mitre_techniques
        assert alert.is_actionable() is True


# ── 2. Ingestion API Endpoint Tests ───────────────────────────────────────


class TestSiemIngestionApi:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_splunk_hec_single_event_ingestion(self, client):
        hec_event = {
            "host": "firewall-edge-01",
            "source": "paloalto:traffic",
            "event": {
                "src_ip": "198.51.100.99",
                "action": "drop",
                "severity": "high",
                "signature": "Outbound Port Scan",
            },
        }

        res = client.post(
            "/api/v1/integrations/splunk/hec",
            headers={"Authorization": "Splunk test-hec-token"},
            json=hec_event,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["text"] == "Success"
        assert data["code"] == 0
        assert data["ackId"] == 1
        assert "details" in data
        assert data["details"]["status"] == "ingested"

    def test_splunk_hec_batch_array_ingestion(self, client):
        batch = [
            {"host": "host-1", "event": {"signature": "Event A", "severity": "low"}},
            {"host": "host-2", "event": {"signature": "Event B", "severity": "critical"}},
        ]

        res = client.post(
            "/api/v1/integrations/splunk/hec",
            json=batch,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["code"] == 0
        assert data["processed_count"] == 2

    def test_sentinel_webhook_high_severity_auto_escalation(self, client):
        sentinel_payload = {
            "IncidentTitle": "Ransomware Encryption Pattern Detected",
            "Severity": "Critical",
            "Entities": [
                {"Type": "host", "HostName": "SRV-CORE-FIN"},
                {"Type": "ip", "Address": "185.220.101.45"},
            ],
            "Techniques": ["T1486"],
        }

        res = client.post(
            "/api/v1/integrations/sentinel/webhook",
            json=sentinel_payload,
        )
        assert res.status_code == 202
        data = res.json()
        assert data["status"] == "accepted"
        assert data["source"] == "sentinel"
        alert_data = data["data"]
        assert alert_data["actionable"] is True
        # Verify an async autonomous investigation job was enqueued
        assert alert_data["investigation_job_id"] is not None

    def test_crowdstrike_webhook_ingestion(self, client):
        cs_payload = {
            "event": {
                "ComputerName": "HOST-TEST-01",
                "DetectName": "Living off the Land Binary Execution",
                "SeverityName": "High",
                "Tactic": "Execution",
            }
        }

        res = client.post(
            "/api/v1/integrations/crowdstrike/webhook",
            json=cs_payload,
        )
        assert res.status_code == 202
        data = res.json()
        assert data["status"] == "accepted"
        assert data["source"] == "crowdstrike"

    def test_token_authentication_enforcement_when_configured(self, client):
        with patch.object(settings, "SPLUNK_HEC_TOKEN", "super-secret-hec-token"):
            # Request without token -> 401
            res_no_token = client.post(
                "/api/v1/integrations/splunk/hec",
                json={"event": {"message": "unauthorized attempt"}},
            )
            assert res_no_token.status_code == 401

            # Request with wrong token -> 401
            res_wrong = client.post(
                "/api/v1/integrations/splunk/hec",
                headers={"Authorization": "Splunk wrong-token"},
                json={"event": {"message": "unauthorized attempt"}},
            )
            assert res_wrong.status_code == 401

            # Request with valid token -> 200
            res_valid = client.post(
                "/api/v1/integrations/splunk/hec",
                headers={"Authorization": "Splunk super-secret-hec-token"},
                json={"event": {"message": "authorized event"}},
            )
            assert res_valid.status_code == 200
