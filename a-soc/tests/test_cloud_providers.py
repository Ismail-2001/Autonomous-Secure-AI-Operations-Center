from unittest.mock import MagicMock

import pytest

from agents.telemetry.cloud_providers import AWSCloudTrailProvider, AzureCloudProvider, CloudEvent, GCPCloudProvider


class TestCloudEvent:
    def test_from_cloudtrail_populates_fields(self):
        raw = {
            "EventId": "evt-123",
            "EventName": "ConsoleLogin",
            "EventTime": "2026-06-05T12:00:00Z",
            "SourceIPAddress": "192.168.1.1",
            "UserIdentity": {"type": "IAMUser", "userName": "admin"},
            "Resources": [{"ResourceType": "AWS::IAM::User", "ResourceName": "admin"}],
        }
        event = CloudEvent.from_cloudtrail(raw)
        assert event.event_id == "evt-123"
        assert event.event_name == "ConsoleLogin"
        assert event.source_ip == "192.168.1.1"
        assert event.user_identity["userName"] == "admin"

    def test_from_cloudtrail_handles_missing_fields(self):
        raw = {}
        event = CloudEvent.from_cloudtrail(raw)
        assert event.event_id == ""
        assert event.event_name == "Unknown"
        assert event.source_ip is None

    def test_to_dict_returns_serializable(self):
        event = CloudEvent(
            event_id="evt-1",
            event_name="CreateUser",
            event_time="2026-06-05T12:00:00Z",
            source_ip="10.0.0.1",
            user_identity={"type": "IAMUser", "userName": "test"},
            resources=[],
            raw={},
        )
        d = event.to_dict()
        assert d["eventID"] == "evt-1"
        assert d["eventName"] == "CreateUser"
        assert d["sourceIPAddress"] == "10.0.0.1"


@pytest.mark.asyncio
class TestAWSCloudTrailProvider:
    async def test_fetch_events_returns_mock_when_no_client(self):
        provider = AWSCloudTrailProvider()
        events = await provider.fetch_events(max_results=3)
        assert len(events) == 3
        assert all(isinstance(e, CloudEvent) for e in events)

    async def test_mock_events_have_expected_fields(self):
        provider = AWSCloudTrailProvider()
        events = await provider.fetch_events(max_results=2)
        for event in events:
            assert event.event_id.startswith("mock-")
            assert event.event_name in ("ConsoleLogin", "CreateUser")
            assert event.source_ip is not None

    async def test_health_check_returns_false_without_creds(self):
        provider = AWSCloudTrailProvider()
        healthy = await provider.health_check()
        assert healthy is False

    async def test_fetch_events_with_real_client(self):
        mock_client = MagicMock()
        mock_client.get_paginator.return_value.paginate.return_value = [
            {
                "Events": [
                    {
                        "EventId": "real-evt-1",
                        "EventName": "StopInstance",
                        "EventTime": "2026-06-05T12:00:00Z",
                        "SourceIPAddress": "203.0.113.5",
                        "UserIdentity": {"type": "AssumedRole", "userName": "admin"},
                        "Resources": [],
                    }
                ]
            }
        ]

        provider = AWSCloudTrailProvider(region="us-west-2", access_key_id="AKIATEST", secret_access_key="testsecret")
        provider._client = mock_client
        provider._healthy = True
        events = await provider.fetch_events(max_results=5)
        assert len(events) == 1
        assert events[0].event_name == "StopInstance"
        assert events[0].source_ip == "203.0.113.5"

    async def test_fetch_events_fallback_to_mock_on_error(self):
        provider = AWSCloudTrailProvider(region="us-east-1")
        provider._get_client = MagicMock(return_value=None)
        events = await provider.fetch_events(max_results=2)
        assert len(events) == 2
        assert events[0].event_id.startswith("mock-")


@pytest.mark.asyncio
class TestGCPCloudProvider:
    async def test_fetch_events_returns_mock_when_no_client(self):
        provider = GCPCloudProvider()
        events = await provider.fetch_events(max_results=3)
        assert len(events) == 3
        assert all(isinstance(e, CloudEvent) for e in events)
        assert all(e.event_id.startswith("gcp-mock-") for e in events)

    async def test_mock_events_have_gcp_fields(self):
        provider = GCPCloudProvider()
        events = await provider.fetch_events(max_results=1)
        assert "google." in events[0].event_name
        assert events[0].user_identity.get("type") == "serviceAccount"

    async def test_health_check_returns_false_without_creds(self):
        provider = GCPCloudProvider()
        healthy = await provider.health_check()
        assert healthy is False

    async def test_fetch_events_with_mock_client(self):
        provider = GCPCloudProvider(project_id="test-project")
        mock_client = MagicMock()
        provider._client = mock_client
        provider._healthy = True
        events = await provider.fetch_events(max_results=2)
        assert len(events) == 2
        assert all(e.event_id.startswith("gcp-mock-") for e in events)

    async def test_fetch_events_fallback_to_mock_on_error(self):
        provider = GCPCloudProvider(project_id="test-project")
        provider._get_client = MagicMock(return_value=None)
        events = await provider.fetch_events(max_results=2)
        assert len(events) == 2
        assert events[0].event_id.startswith("gcp-mock-")


@pytest.mark.asyncio
class TestAzureCloudProvider:
    async def test_fetch_events_returns_mock_when_no_client(self):
        provider = AzureCloudProvider()
        events = await provider.fetch_events(max_results=3)
        assert len(events) == 3
        assert all(isinstance(e, CloudEvent) for e in events)
        assert all(e.event_id.startswith("azure-mock-") for e in events)

    async def test_mock_events_have_azure_fields(self):
        provider = AzureCloudProvider()
        events = await provider.fetch_events(max_results=1)
        assert "MICROSOFT." in events[0].event_name
        assert events[0].user_identity.get("type") == "AzureAD"

    async def test_health_check_returns_false_without_creds(self):
        provider = AzureCloudProvider()
        healthy = await provider.health_check()
        assert healthy is False

    async def test_fetch_events_with_mock_client(self):
        provider = AzureCloudProvider(
            tenant_id="test-tenant", client_id="test-client", client_secret="test-secret", subscription_id="test-sub"
        )
        mock_client = MagicMock()
        provider._client = mock_client
        provider._healthy = True
        events = await provider.fetch_events(max_results=2)
        assert len(events) == 2
        assert all(e.event_id.startswith("azure-mock-") for e in events)

    async def test_fetch_events_fallback_to_mock_on_error(self):
        provider = AzureCloudProvider(tenant_id="test-tenant")
        provider._get_client = MagicMock(return_value=None)
        events = await provider.fetch_events(max_results=2)
        assert len(events) == 2
        assert events[0].event_id.startswith("azure-mock-")
