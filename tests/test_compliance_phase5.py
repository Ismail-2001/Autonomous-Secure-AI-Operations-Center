"""Phase 5 Comprehensive Test Suite: Compliance Exporter, Cryptographic Integrity & Prometheus Alerts.

Validates:
1. SOC 2 Type II evidence package generation and control mapping.
2. ISO/IEC 27001:2022 evidence package generation and control mapping.
3. Cryptographic SHA-256 evidence manifest integrity check.
4. RBAC security enforcement on /api/v1/compliance/export (Supervisor required).
5. Prometheus alerting rules configuration syntax and coverage.
"""

import hashlib
import json
from unittest.mock import AsyncMock, patch

import pytest
import yaml
from fastapi.testclient import TestClient

from src.asoc.api.app import app
from src.asoc.audit.compliance_exporter import (
    ComplianceExporter,
    ControlStatus,
    Framework,
    get_compliance_exporter,
)
from src.asoc.core.jwt_handler import Role, create_token_pair


class TestComplianceEvidenceExporter:
    @pytest.mark.asyncio
    async def test_soc2_evidence_package_generation(self):
        exporter = ComplianceExporter()
        package = await exporter.generate_evidence_package(framework=Framework.SOC2, days=7)

        assert package.framework == "soc2"
        assert package.controls_evaluated == 5
        assert package.controls_passed >= 4
        assert package.overall_score >= 80.0
        assert package.status == ControlStatus.PASS

        # Verify all SOC 2 CC controls present
        control_ids = {c.control_id for c in package.controls}
        expected = {"SOC2.CC6.1", "SOC2.CC6.8", "SOC2.CC7.1", "SOC2.CC7.2", "SOC2.CC7.3"}
        assert expected.issubset(control_ids)

        # Verify sample artifacts contain required security evidence
        lockout_control = next(c for c in package.controls if c.control_id == "SOC2.CC6.8")
        assert any(a.get("control") == "Argon2id" for a in lockout_control.sample_artifacts)

    @pytest.mark.asyncio
    async def test_iso27001_evidence_package_generation(self):
        exporter = ComplianceExporter()
        package = await exporter.generate_evidence_package(framework=Framework.ISO27001, days=14)

        assert package.framework == "iso27001"
        assert package.controls_evaluated == 4
        assert package.controls_passed == 4
        assert package.overall_score == 100.0

        control_ids = {c.control_id for c in package.controls}
        expected = {"ISO.A.5.24", "ISO.A.5.28", "ISO.A.8.15", "ISO.A.8.16"}
        assert expected.issubset(control_ids)

    @pytest.mark.asyncio
    async def test_cryptographic_manifest_sha256_integrity(self):
        exporter = ComplianceExporter()
        package1 = await exporter.generate_evidence_package(framework=Framework.ALL, days=30)
        assert len(package1.manifest_sha256) == 64
        assert package1.manifest_sha256.isalnum()

        # Recompute hash over controls to ensure reproducibility
        evidence_payload = {
            "period_start": package1.period_start,
            "period_end": package1.period_end,
            "framework": package1.framework,
            "controls": [c.model_dump() for c in package1.controls],
            "total_audit_events_analyzed": 0,  # in test memory
        }
        computed = hashlib.sha256(json.dumps(evidence_payload, sort_keys=True).encode("utf-8")).hexdigest()
        assert package1.manifest_sha256 == computed


class TestComplianceApiEndpoints:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_compliance_export_rbac_enforcement(self, client):
        analyst_tokens = create_token_pair(user_id="analyst-test", role=Role.ANALYST)
        viewer_tokens = create_token_pair(user_id="viewer-test", role=Role.VIEWER)
        supervisor_tokens = create_token_pair(user_id="supervisor-test", role=Role.SUPERVISOR)
        admin_tokens = create_token_pair(user_id="admin-test", role=Role.ADMIN)

        # 1. Unauthenticated request -> 401 Unauthorized
        res_anon = client.get("/api/v1/compliance/export")
        assert res_anon.status_code == 401

        # 2. Viewer role -> 403 Forbidden
        res_viewer = client.get(
            "/api/v1/compliance/export",
            headers={"Authorization": f"Bearer {viewer_tokens.access_token}"},
        )
        assert res_viewer.status_code == 403

        # 3. Analyst role -> 403 Forbidden (Only Supervisor and Admin can export compliance evidence)
        res_analyst = client.get(
            "/api/v1/compliance/export",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
        )
        assert res_analyst.status_code == 403

        # 4. Supervisor role -> 200 OK
        res_sup = client.get(
            "/api/v1/compliance/export?framework=soc2&days=15",
            headers={"Authorization": f"Bearer {supervisor_tokens.access_token}"},
        )
        assert res_sup.status_code == 200
        data = res_sup.json()
        assert data["framework"] == "soc2"
        assert "manifest_sha256" in data
        assert len(data["controls"]) > 0

        # 5. Admin role -> 200 OK
        res_admin = client.get(
            "/api/v1/compliance/export?framework=all",
            headers={"Authorization": f"Bearer {admin_tokens.access_token}"},
        )
        assert res_admin.status_code == 200
        assert res_admin.json()["controls_evaluated"] == 9


class TestPrometheusAlertRules:
    def test_alert_rules_yaml_syntax_and_required_metrics(self):
        with open("monitoring/alerting-rules.yml", "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        assert "groups" in data
        asoc_group = next((g for g in data["groups"] if g["name"] == "asoc"), None)
        assert asoc_group is not None

        rules = asoc_group["rules"]
        alert_names = [r["alert"] for r in rules]

        # Verify core infrastructure alerts
        assert "HighErrorRate" in alert_names
        assert "CircuitBreakerOpen" in alert_names
        assert "DatabaseDown" in alert_names

        # Verify Phase 5 enterprise alert rules
        assert "ASOCWorkerJobFailureRateHigh" in alert_names
        assert "ASOCStaleLockRecoveredSpike" in alert_names
        assert "ASOCLLMFallbackSpike" in alert_names
        assert "ASOCAuthAccountLockoutSpike" in alert_names
        assert "ASOCHMACVerificationFailure" in alert_names

        for r in rules:
            assert "expr" in r, f"Rule {r['alert']} missing expr"
            assert "labels" in r, f"Rule {r['alert']} missing labels"
            assert "annotations" in r, f"Rule {r['alert']} missing annotations"
            assert "summary" in r["annotations"]
