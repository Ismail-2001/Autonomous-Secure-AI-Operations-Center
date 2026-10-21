"""War Game Adversarial Simulation Test Suite.

Validates:
1. Multi-stage ransomware scenario execution (BlackCat/ALPHV).
2. Cloud data exfiltration scenario execution (Scattered Spider).
3. Precision MTTD (Mean Time to Detect) & MTTR (Mean Time to Respond) calculation.
4. Cryptographic compliance evidence manifest generation.
5. Simulation API endpoints & RBAC enforcement.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.asoc.api.app import app
from src.asoc.core.jwt_handler import Role, create_token_pair
from src.asoc.tools.war_game import SCENARIOS, WarGameEngine, WarGameReport


class TestWarGameEngineExecution:
    @pytest.mark.asyncio
    async def test_ransomware_scenario_execution_in_shadow_mode(self):
        engine = WarGameEngine()
        report = await engine.run(
            scenario_key="ransomware",
            execution_mode="SHADOW",
            delay_between_steps=0.0,
        )

        assert isinstance(report, WarGameReport)
        assert report.incident_id.startswith("WARGAME-")
        assert report.threat_actor == "ALPHV (BlackCat)"
        assert report.execution_mode == "SHADOW"
        assert report.containment_status == "SUCCESS_SIMULATED"
        assert "QUARANTINE_HOST" in report.containment_action_taken

        # 4 attack stages
        assert len(report.steps) == 4
        assert [s.step_number for s in report.steps] == [1, 2, 3, 4]

        # Verify MITRE techniques mapped
        techniques = [s.technique_id for s in report.steps]
        assert "T1078" in techniques
        assert "T1486" in techniques

        # Verify MTTD and MTTR timings recorded
        assert report.mttd_ms >= 0.0
        assert report.mttr_ms >= 0.0
        assert report.total_duration_ms > 0.0

        # Verify Threat Intel IOC match
        assert any("185.220.101.45" in ti for ti in report.threat_intel_matches)

        # Verify Cryptographic SHA-256 compliance manifest
        assert len(report.compliance_manifest_sha256) == 64
        assert report.compliance_manifest_sha256.isalnum()

    @pytest.mark.asyncio
    async def test_cloud_exfiltration_scenario_execution(self):
        engine = WarGameEngine()
        report = await engine.run(
            scenario_key="exfiltration",
            execution_mode="ACTIVE_ENFORCEMENT",
            delay_between_steps=0.0,
        )

        assert report.threat_actor == "Scattered Spider (UNC3944)"
        assert report.execution_mode == "ACTIVE_ENFORCEMENT"
        assert report.containment_status == "SUCCESS_ENFORCED"
        assert len(report.steps) == 3

        techniques = [s.technique_id for s in report.steps]
        assert "T1110" in techniques
        assert "T1530" in techniques

    @pytest.mark.asyncio
    async def test_invalid_scenario_raises_value_error(self):
        engine = WarGameEngine()
        with pytest.raises(ValueError, match="Unknown scenario"):
            await engine.run(scenario_key="non_existent_exploit")


class TestWarGameApiEndpoints:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_list_scenarios_requires_analyst(self, client):
        viewer_tokens = create_token_pair(user_id="viewer-wg-test", role=Role.VIEWER)
        analyst_tokens = create_token_pair(user_id="analyst-wg-test", role=Role.ANALYST)

        # Unauthenticated -> 401
        res_anon = client.get("/api/v1/simulation/scenarios")
        assert res_anon.status_code == 401

        # Viewer -> 403
        res_viewer = client.get(
            "/api/v1/simulation/scenarios",
            headers={"Authorization": f"Bearer {viewer_tokens.access_token}"},
        )
        assert res_viewer.status_code == 403

        # Analyst -> 200 OK
        res_analyst = client.get(
            "/api/v1/simulation/scenarios",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
        )
        assert res_analyst.status_code == 200
        data = res_analyst.json()
        assert "ransomware" in data
        assert "exfiltration" in data

    def test_trigger_war_game_simulation_api(self, client):
        analyst_tokens = create_token_pair(user_id="analyst-wg-test", role=Role.ANALYST)

        res = client.post(
            "/api/v1/simulation/war-game",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
            json={"scenario": "ransomware", "mode": "SHADOW", "delay_between_steps": 0.0},
        )
        assert res.status_code == 200
        report = res.json()
        assert report["incident_id"].startswith("WARGAME-")
        assert report["scenario_name"] == "BlackCat / ALPHV Ransomware Campaign"
        assert report["execution_mode"] == "SHADOW"
        assert "mttd_ms" in report
        assert "compliance_manifest_sha256" in report
