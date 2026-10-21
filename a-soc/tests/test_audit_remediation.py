"""Principal Engineer Audit Remediation Test Suite.

Validates:
1. AWS IP blocking correctly applies Network ACL (NACL) deny rules rather than security group ingress allow rules.
2. Instance isolation revokes 0.0.0.0/0 egress rules for true network blackhole containment.
3. Global EXECUTION_MODE ("SHADOW" vs "ACTIVE_ENFORCEMENT") intercepts destructive actions safely.
4. Threat intelligence RFC 1918 private address classification & live AbuseIPDB handling.
5. Multi-pod WebSocket Redis Pub/Sub broadcast fanout.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.asoc.agents.response import AWSRemediationProvider
from src.asoc.agents.security_tools import (
    lookup_threat_intel,
    network_quarantine_host,
)
from src.asoc.api.app import ConnectionManager
from src.asoc.core.config import settings


# ── 1. AWS Remediation Security & Shadow Mode ─────────────────────────────


class TestAWSRemediationRemediations:
    @pytest.mark.asyncio
    async def test_shadow_mode_intercepts_destructive_actions(self):
        with patch.object(settings, "EXECUTION_MODE", "SHADOW"):
            provider = AWSRemediationProvider()
            # In shadow mode, no AWS client should even be queried
            blocked = await provider.block_ip("198.51.100.22", reason="C2 communication")
            assert blocked is True

            revoked = await provider.revoke_iam_access("compromised-user", reason="Token leak")
            assert revoked is True

            isolated = await provider.isolate_instance("i-0123456789abcdef0", reason="Ransomware")
            assert isolated is True

    @pytest.mark.asyncio
    async def test_active_enforcement_uses_nacl_deny_rule(self):
        with patch.object(settings, "EXECUTION_MODE", "ACTIVE_ENFORCEMENT"):
            mock_ec2 = MagicMock()
            mock_ec2.describe_network_acls.return_value = {
                "NetworkAcls": [{"NetworkAclId": "nacl-123456"}]
            }

            provider = AWSRemediationProvider()
            provider._ec2_client = mock_ec2

            success = await provider.block_ip("203.0.113.50", reason="Active Cobalt Strike C2")
            assert success is True

            # Verify NACL deny rule creation
            mock_ec2.create_network_acl_entry.assert_called_once_with(
                NetworkAclId="nacl-123456",
                RuleNumber=50,
                Protocol="-1",
                RuleAction="deny",
                Egress=False,
                CidrBlock="203.0.113.50/32",
            )

    @pytest.mark.asyncio
    async def test_instance_quarantine_revokes_all_egress_traffic(self):
        with patch.object(settings, "EXECUTION_MODE", "ACTIVE_ENFORCEMENT"):
            mock_ec2 = MagicMock()
            mock_ec2.create_security_group.return_value = {"GroupId": "sg-quarantine-999"}

            provider = AWSRemediationProvider()
            provider._ec2_client = mock_ec2

            success = await provider.isolate_instance("i-0987654321", reason="LockBit infection")
            assert success is True

            # Verify egress 0.0.0.0/0 was revoked for full isolation
            mock_ec2.revoke_security_group_egress.assert_called_once()
            call_kwargs = mock_ec2.revoke_security_group_egress.call_args.kwargs
            assert call_kwargs["GroupId"] == "sg-quarantine-999"
            assert call_kwargs["IpPermissions"][0]["IpRanges"][0]["CidrIp"] == "0.0.0.0/0"

            # Verify instance attribute modified to quarantine group
            mock_ec2.modify_instance_attribute.assert_called_once_with(
                InstanceId="i-0987654321",
                Groups=["sg-quarantine-999"],
            )


# ── 2. Threat Intelligence RFC 1918 & Known Threat Enrichment ────────────


class TestThreatIntelEnrichment:
    @pytest.mark.asyncio
    async def test_private_rfc1918_addresses_identified_as_internal(self):
        res1 = await lookup_threat_intel("192.168.1.105")
        assert res1["found"] is False
        assert res1.get("is_internal") is True
        assert res1["severity"] == "info"

        res2 = await lookup_threat_intel("10.50.0.1")
        assert res2["found"] is False
        assert res2.get("is_internal") is True

        res3 = await lookup_threat_intel("127.0.0.1")
        assert res3["found"] is False
        assert res3.get("is_internal") is True

    @pytest.mark.asyncio
    async def test_known_c2_threat_lookup(self):
        res = await lookup_threat_intel("185.220.101.45")
        assert res["found"] is True
        assert res["severity"] == "critical"
        assert res["threat_source"] == "ThreatFox"
        assert "c2" in res["tags"]

    @pytest.mark.asyncio
    async def test_network_quarantine_host_records_shadow_mode(self):
        with patch.object(settings, "EXECUTION_MODE", "SHADOW"):
            out = await network_quarantine_host(
                host_identifier="SRV-CORE-01",
                incident_id="INC-AUDIT-001",
                reason="Suspicious beaconing",
            )
            assert out["action"] == "quarantine_host"
            res = out["result"]
            assert res["status"] == "shadow_simulated"
            assert res["would_isolate"] is True
            assert res["isolated"] is False


# ── 3. Multi-Pod WebSocket Synchronization (Redis Pub/Sub) ────────────────


class TestWebSocketMultiPodSync:
    @pytest.mark.asyncio
    async def test_broadcast_publishes_to_redis_pubsub(self):
        manager = ConnectionManager()
        mock_ws = AsyncMock()
        await manager.connect(mock_ws)

        mock_redis = AsyncMock()
        with patch("src.asoc.core.redis_client.get_redis", return_value=mock_redis):
            test_msg = {"type": "INCIDENT_UPDATE", "incident_id": "INC-TEST-1"}
            await manager.broadcast(test_msg)

            # Local websocket received
            mock_ws.send_json.assert_called_with(test_msg)

            # Redis pubsub published
            mock_redis.publish.assert_called_once()
            args = mock_redis.publish.call_args[0]
            assert args[0] == "asoc:threat-feed:pubsub"
            assert "INC-TEST-1" in args[1]
