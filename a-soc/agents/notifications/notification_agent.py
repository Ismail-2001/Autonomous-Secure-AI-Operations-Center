import abc
import base64
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType, Priority
from core.config.settings import settings
from core.logging import get_logger
from core.retry import async_retry

logger = get_logger("asoc.notifications")


class NotificationProvider(abc.ABC):
    @abc.abstractmethod
    async def send(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool: ...


class SlackWebhookProvider(NotificationProvider):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool:
        color_map = {"low": "#36a64f", "medium": "#ffcc00", "high": "#ff6600", "critical": "#ff0000"}
        payload = {
            "attachments": [
                {
                    "color": color_map.get(severity, "#36a64f"),
                    "title": title,
                    "text": message,
                    "fields": [{"title": k, "value": v, "short": True} for k, v in (fields or {}).items()],
                    "footer": "A-SOC",
                    "ts": datetime.now(timezone.utc).timestamp(),
                }
            ]
        }
        return await self._post(payload)

    async def _post(self, payload: Dict[str, Any]) -> bool:
        async def _do_post():
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                resp.raise_for_status()
                logger.info("slack_sent")
                return True

        try:
            return await async_retry(_do_post, max_retries=3, exceptions=(httpx.HTTPError, httpx.TimeoutException))
        except Exception as e:
            logger.error("slack_failed", error=str(e))
            return False


class TeamsWebhookProvider(NotificationProvider):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool:
        color_map = {"low": "good", "medium": "warning", "high": "warning", "critical": "attention"}
        facts = [{"name": k, "value": v} for k, v in (fields or {}).items()]
        payload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.4",
                        "body": [
                            {"type": "TextBlock", "text": title, "weight": "bolder", "size": "large"},
                            {"type": "TextBlock", "text": message, "wrap": True},
                            {"type": "FactSet", "facts": [{"name": "Severity", "value": severity.upper()}, *facts]},
                            {
                                "type": "TextBlock",
                                "text": f"A-SOC | {datetime.now(timezone.utc).isoformat()}",
                                "size": "small",
                                "isSubtle": True,
                            },
                        ],
                    },
                }
            ],
        }
        return await self._post(payload)

    async def _post(self, payload: Dict[str, Any]) -> bool:
        async def _do_post():
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                resp.raise_for_status()
                logger.info("teams_sent")
                return True

        try:
            return await async_retry(_do_post, max_retries=3, exceptions=(httpx.HTTPError, httpx.TimeoutException))
        except Exception as e:
            logger.error("teams_failed", error=str(e))
            return False


class JiraProvider(NotificationProvider):
    def __init__(self, url: str, email: str, api_token: str, project_key: str):
        self.url = url.rstrip("/")
        self.email = email
        self.api_token = api_token
        self.project_key = project_key
        self._auth_header = base64.b64encode(f"{email}:{api_token}".encode()).decode()

    async def send(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool:
        priority_map = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Highest"}
        labels = ["a-soc", f"severity-{severity}"]
        description_parts = [f"*Severity:* {severity.upper()}", "", message, "", "---", "### Fields"]
        for k, v in (fields or {}).items():
            description_parts.append(f"*{k}:* {v}")
        description_parts.append("")
        description_parts.append(f"*Generated by:* A-SOC | {datetime.now(timezone.utc).isoformat()}")

        payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": title[:255],
                "description": "\n".join(description_parts),
                "priority": {"name": priority_map.get(severity, "Medium")},
                "labels": labels,
            }
        }
        return await self._post(payload)

    async def _post(self, payload: Dict[str, Any]) -> bool:
        async def _do_post():
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.url}/rest/api/2/issue",
                    json=payload,
                    headers={
                        "Authorization": f"Basic {self._auth_header}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )
                resp.raise_for_status()
                logger.info("jira_created", ticket_key=resp.json().get("key", "unknown"))
                return True

        try:
            return await async_retry(_do_post, max_retries=3, exceptions=(httpx.HTTPError, httpx.TimeoutException))
        except Exception as e:
            logger.error("jira_failed", error=str(e))
            return False


class NotificationAgent(BaseAgent):
    def __init__(self, providers: Optional[List[NotificationProvider]] = None):
        super().__init__(
            name="NotificationAgent", description="Sends security alerts via Slack, Teams webhooks, and JIRA"
        )
        self.providers = providers or self._default_providers()

    def _default_providers(self) -> List[NotificationProvider]:
        providers: List[NotificationProvider] = []
        if settings.SLACK_WEBHOOK_URL:
            providers.append(SlackWebhookProvider(settings.SLACK_WEBHOOK_URL))
        if settings.TEAMS_WEBHOOK_URL:
            providers.append(TeamsWebhookProvider(settings.TEAMS_WEBHOOK_URL))
        if settings.JIRA_URL and settings.JIRA_EMAIL and settings.JIRA_API_TOKEN and settings.JIRA_PROJECT_KEY:
            providers.append(
                JiraProvider(
                    settings.JIRA_URL,
                    settings.JIRA_EMAIL,
                    settings.JIRA_API_TOKEN.get_secret_value(),
                    settings.JIRA_PROJECT_KEY,
                )
            )
        return providers

    async def send_alert(
        self, title: str, message: str, severity: str = "low", fields: Optional[Dict[str, str]] = None
    ) -> bool:
        if not self.providers:
            logger.info("no_providers_configured")
            return False
        results = [await provider.send(title, message, severity, fields) for provider in self.providers]
        return all(results)

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type in (MessageType.ALERT, MessageType.LOG):
            severity_map = {
                Priority.LOW: "low",
                Priority.MEDIUM: "medium",
                Priority.HIGH: "high",
                Priority.CRITICAL: "critical",
            }
            severity = severity_map.get(message.priority, "low")
            await self.send_alert(
                title=f"A-SOC Alert: {message.source_agent}",
                message=message.payload.get("reasoning", str(message.payload)),
                severity=severity,
                fields={
                    "Agent": message.source_agent,
                    "Incident": message.correlation_id or "N/A",
                    "Priority": message.priority.name if hasattr(message.priority, "name") else str(message.priority),
                },
            )
        return None
