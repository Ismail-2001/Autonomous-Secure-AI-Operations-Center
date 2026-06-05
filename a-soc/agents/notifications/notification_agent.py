import abc
import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType, Priority
from core.config.settings import settings

logger = logging.getLogger("asoc.notifications")


class NotificationProvider(abc.ABC):
    @abc.abstractmethod
    async def send(
        self,
        title: str,
        message: str,
        severity: str,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool: ...


class SlackWebhookProvider(NotificationProvider):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(
        self,
        title: str,
        message: str,
        severity: str,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
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
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                resp.raise_for_status()
                logger.info("Slack notification sent successfully")
                return True
        except Exception as e:
            logger.error(f"Slack notification failed: {e}")
            return False


class TeamsWebhookProvider(NotificationProvider):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(
        self,
        title: str,
        message: str,
        severity: str,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
        color_map = {"low": "good", "medium": "warning", "high": "warning", "critical": "attention"}
        facts = [{"name": k, "value": v} for k, v in (fields or {}).items()]
        severity_display = severity.upper()
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
                            {"type": "FactSet", "facts": [{"name": "Severity", "value": severity_display}, *facts]},
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
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                resp.raise_for_status()
                logger.info("Teams notification sent successfully")
                return True
        except Exception as e:
            logger.error(f"Teams notification failed: {e}")
            return False


class JiraProvider(NotificationProvider):
    def __init__(self, url: str, email: str, api_token: str, project_key: str):
        self.url = url.rstrip("/")
        self.email = email
        self.api_token = api_token
        self.project_key = project_key
        self._auth_header = base64.b64encode(f"{email}:{api_token}".encode()).decode()

    async def send(
        self,
        title: str,
        message: str,
        severity: str,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
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
        try:
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
                logger.info(f"JIRA ticket created: {resp.json().get('key', 'unknown')}")
                return True
        except Exception as e:
            logger.error(f"JIRA ticket creation failed: {e}")
            return False


class NotificationAgent(BaseAgent):
    def __init__(self, providers: Optional[List[NotificationProvider]] = None):
        super().__init__(
            name="NotificationAgent", description="Sends security alerts via Slack, Teams webhooks, and JIRA"
        )
        self.providers = providers or self._default_providers()

    def _default_providers(self) -> List[NotificationProvider]:
        providers: List[NotificationProvider] = []
        slack_url = settings.SLACK_WEBHOOK_URL
        teams_url = settings.TEAMS_WEBHOOK_URL
        if slack_url:
            providers.append(SlackWebhookProvider(slack_url))
        if teams_url:
            providers.append(TeamsWebhookProvider(teams_url))
        jira_url = settings.JIRA_URL
        jira_email = settings.JIRA_EMAIL
        jira_token = settings.JIRA_API_TOKEN
        jira_project = settings.JIRA_PROJECT_KEY
        if jira_url and jira_email and jira_token and jira_project:
            providers.append(JiraProvider(jira_url, jira_email, jira_token.get_secret_value(), jira_project))
        return providers

    async def send_alert(
        self,
        title: str,
        message: str,
        severity: str = "low",
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
        if not self.providers:
            logger.info("No notification providers configured. Set webhook or JIRA credentials.")
            return False

        results = []
        for provider in self.providers:
            ok = await provider.send(title, message, severity, fields)
            results.append(ok)
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
