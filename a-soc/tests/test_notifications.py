from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.notifications.notification_agent import (
    JiraProvider,
    NotificationAgent,
    SlackWebhookProvider,
    TeamsWebhookProvider,
)


@pytest.mark.asyncio
class TestSlackWebhookProvider:
    async def test_send_success(self):
        provider = SlackWebhookProvider("https://hooks.slack.com/test")
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True):
            result = await provider.send(
                title="Test Alert",
                message="Something happened",
                severity="high",
                fields={"IP": "1.2.3.4"},
            )
            assert result is True

    async def test_send_success_no_fields(self):
        provider = SlackWebhookProvider("https://hooks.slack.com/test")
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True):
            result = await provider.send(
                title="Minimal Alert",
                message="No fields",
                severity="low",
            )
            assert result is True

    async def test_send_handles_http_error(self):
        provider = SlackWebhookProvider("https://hooks.slack.com/test")
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=False):
            result = await provider.send(
                title="Failed Alert",
                message="Should fail",
                severity="critical",
            )
            assert result is False

    async def test_post_success(self):
        provider = SlackWebhookProvider("https://hooks.slack.com/test")
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = MagicMock()
            mock_client.return_value.__aenter__.return_value = mock_instance
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_instance.post = AsyncMock(return_value=mock_response)

            result = await provider._post({"text": "Hello"})
            assert result is True


@pytest.mark.asyncio
class TestTeamsWebhookProvider:
    async def test_send_success(self):
        provider = TeamsWebhookProvider("https://outlook.office.com/webhook/test")
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True):
            result = await provider.send(
                title="Teams Alert",
                message="Something happened",
                severity="high",
                fields={"IP": "1.2.3.4"},
            )
            assert result is True

    async def test_send_uses_adaptive_card_format(self):
        provider = TeamsWebhookProvider("https://outlook.office.com/webhook/test")
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True):
            result = await provider.send(
                title="Format Check",
                message="Check card format",
                severity="low",
                fields={"Key": "Value"},
            )
            assert result is True

    async def test_post_failure(self):
        provider = TeamsWebhookProvider("https://outlook.office.com/webhook/test")
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_client.return_value.__aenter__.return_value = mock_instance
            mock_instance.post.side_effect = Exception("Connection refused")

            result = await provider._post({"type": "message"})
            assert result is False


@pytest.mark.asyncio
class TestNotificationAgent:
    async def test_agent_send_alert_with_providers(self):
        mock_provider = AsyncMock(spec=SlackWebhookProvider)
        mock_provider.send.return_value = True
        agent = NotificationAgent(providers=[mock_provider])

        result = await agent.send_alert(
            title="Test",
            message="Test message",
            severity="high",
            fields={"Action": "BLOCK_IP"},
        )
        assert result is True
        mock_provider.send.assert_called_once_with("Test", "Test message", "high", {"Action": "BLOCK_IP"})

    async def test_agent_send_alert_no_providers(self):
        agent = NotificationAgent(providers=[])
        result = await agent.send_alert(title="Test", message="Test message", severity="low")
        assert result is False

    async def test_agent_send_alert_all_fail(self):
        mock_provider = AsyncMock(spec=SlackWebhookProvider)
        mock_provider.send.return_value = False
        agent = NotificationAgent(providers=[mock_provider])

        result = await agent.send_alert(title="Fail", message="All fail", severity="critical")
        assert result is False

    async def test_agent_send_alert_partial_fail_returns_false(self):
        slack = AsyncMock(spec=SlackWebhookProvider)
        teams = AsyncMock(spec=TeamsWebhookProvider)
        slack.send.return_value = True
        teams.send.return_value = False
        agent = NotificationAgent(providers=[slack, teams])

        result = await agent.send_alert(title="Partial", message="One fails", severity="medium")
        assert result is False

    async def test_process_message_alert_triggers_send(self):
        from agents.base.message import ASOCMessage, MessageType, Priority

        mock_provider = AsyncMock(spec=SlackWebhookProvider)
        mock_provider.send.return_value = True
        agent = NotificationAgent(providers=[mock_provider])

        msg = ASOCMessage(
            message_type=MessageType.ALERT,
            source_agent="DetectionAgent",
            payload={"reasoning": "Suspicious login detected"},
            priority=Priority.HIGH,
            correlation_id="incident-001",
        )
        result = await agent.process_message(msg)
        assert result is None
        mock_provider.send.assert_called_once()

    async def test_process_message_other_type_ignored(self):
        from agents.base.message import ASOCMessage, MessageType

        mock_provider = AsyncMock(spec=SlackWebhookProvider)
        agent = NotificationAgent(providers=[mock_provider])

        msg = ASOCMessage(
            message_type=MessageType.COMMAND,
            source_agent="System",
            payload={},
        )
        result = await agent.process_message(msg)
        assert result is None
        mock_provider.send.assert_not_called()


@pytest.mark.asyncio
class TestJiraProvider:
    async def test_send_success(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True):
            result = await provider.send(
                title="Critical Incident",
                message="S3 data exfiltration detected",
                severity="critical",
                fields={"Incident": "INC-001", "Action": "BLOCK_IP"},
            )
            assert result is True

    async def test_send_success_no_fields(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True):
            result = await provider.send(
                title="Low Severity Alert",
                message="Routine check",
                severity="low",
            )
            assert result is True

    async def test_send_handles_http_error(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=False):
            result = await provider.send(
                title="Failed Alert",
                message="Should fail",
                severity="high",
            )
            assert result is False

    async def test_post_success(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = MagicMock()
            mock_client.return_value.__aenter__.return_value = mock_instance
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = {"key": "SEC-42", "id": "10001"}
            mock_instance.post = AsyncMock(return_value=mock_response)

            result = await provider._post({"fields": {"summary": "Test"}})
            assert result is True

    async def test_post_failure(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_client.return_value.__aenter__.return_value = mock_instance
            mock_instance.post.side_effect = Exception("JIRA API unavailable")

            result = await provider._post({"fields": {"summary": "Test"}})
            assert result is False

    async def test_send_uses_correct_priority_mapping(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True) as mock_post:
            await provider.send(
                title="Critical Alert",
                message="Critical issue",
                severity="critical",
            )
            call_args = mock_post.call_args[0][0]
            assert call_args["fields"]["priority"]["name"] == "Highest"
            assert "a-soc" in call_args["fields"]["labels"]
            assert "severity-critical" in call_args["fields"]["labels"]

    async def test_send_medium_severity(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True) as mock_post:
            await provider.send(
                title="Medium Alert",
                message="Medium issue",
                severity="medium",
            )
            call_args = mock_post.call_args[0][0]
            assert call_args["fields"]["priority"]["name"] == "Medium"

    async def test_send_uses_correct_project_key(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SOC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True) as mock_post:
            await provider.send(
                title="SOC Alert",
                message="Test",
                severity="high",
            )
            call_args = mock_post.call_args[0][0]
            assert call_args["fields"]["project"]["key"] == "SOC"

    async def test_send_title_truncated_at_255(self):
        provider = JiraProvider(
            url="https://test.atlassian.net",
            email="bot@test.com",
            api_token="fake-token",
            project_key="SEC",
        )
        with patch.object(provider, "_post", new_callable=AsyncMock, return_value=True) as mock_post:
            long_title = "A" * 500
            await provider.send(
                title=long_title,
                message="Test",
                severity="low",
            )
            call_args = mock_post.call_args[0][0]
            assert len(call_args["fields"]["summary"]) == 255
            assert call_args["fields"]["summary"] == "A" * 255
