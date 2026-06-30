import abc
import base64
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from langsmith import traceable

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger
from src.asoc.core.retry import async_retry
from src.asoc.middleware.prompt_injection import validate_agent_input

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

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="send_slack_alert",
            func=self._tool_send_slack,
            description="Send alert to configured Slack webhook",
            input_schema={"title": {"type": "string"}, "message": {"type": "string"}, "severity": {"type": "string"}},
            output_schema={"sent": {"type": "boolean"}},
        )
        self.tool_registry.register(
            name="send_teams_alert",
            func=self._tool_send_teams,
            description="Send alert to configured Microsoft Teams webhook",
            input_schema={"title": {"type": "string"}, "message": {"type": "string"}, "severity": {"type": "string"}},
            output_schema={"sent": {"type": "boolean"}},
        )
        self.tool_registry.register(
            name="create_jira_ticket",
            func=self._tool_create_jira,
            description="Create a JIRA ticket for the security incident",
            input_schema={"title": {"type": "string"}, "message": {"type": "string"}, "severity": {"type": "string"}},
            output_schema={"sent": {"type": "boolean"}},
        )
        self.tool_registry.register(
            name="format_alert_message",
            func=self._tool_format_message,
            description="Format raw incident data into a standardized alert message",
            input_schema={"source_agent": {"type": "string"}, "payload": {"type": "object"}, "priority": {"type": "string"}},
            output_schema={"title": {"type": "string"}, "message": {"type": "string"}, "severity": {"type": "string"}, "fields": {"type": "object"}},
        )

    async def _tool_send_slack(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool:
        slack_providers = [p for p in self.providers if isinstance(p, SlackWebhookProvider)]
        if not slack_providers:
            return False
        results = [await p.send(title, message, severity, fields) for p in slack_providers]
        return all(results)

    async def _tool_send_teams(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool:
        teams_providers = [p for p in self.providers if isinstance(p, TeamsWebhookProvider)]
        if not teams_providers:
            return False
        results = [await p.send(title, message, severity, fields) for p in teams_providers]
        return all(results)

    async def _tool_create_jira(self, title: str, message: str, severity: str, fields: Optional[Dict[str, str]] = None) -> bool:
        jira_providers = [p for p in self.providers if isinstance(p, JiraProvider)]
        if not jira_providers:
            return False
        results = [await p.send(title, message, severity, fields) for p in jira_providers]
        return all(results)

    async def _tool_format_message(self, source_agent: str, payload: Dict[str, Any], priority: str = "low") -> Dict[str, Any]:
        severity_map = {"low": "low", "medium": "medium", "high": "high", "critical": "critical"}
        severity = severity_map.get(priority.lower(), "low")
        title = f"A-SOC Alert: {source_agent}"
        message = payload.get("reasoning", str(payload))
        fields = {
            "Agent": source_agent,
            "Incident": payload.get("incident_id", "N/A"),
            "Priority": priority.upper(),
        }
        return {"title": title, "message": message, "severity": severity, "fields": fields}

    async def send_alert(
        self, title: str, message: str, severity: str = "low", fields: Optional[Dict[str, str]] = None
    ) -> bool:
        validate_agent_input("NotificationAgent", title=title, message=message)

        if not self.providers:
            logger.info("no_providers_configured")
            return False
        results = [await provider.send(title, message, severity, fields) for provider in self.providers]
        return all(results)

    @traceable(name="notification_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        latest_msg = state["messages"][-1] if state.get("messages") else None
        observations = state.get("agent_observations", [])
        return {
            "message": latest_msg,
            "observation": observations[-1].model_dump() if observations else {},
            "provider_count": len(self.providers),
        }

    @traceable(name="notification_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        msg = perceived.get("message")
        if not msg:
            return []
        calls = [
            {"tool": "format_alert_message", "args": {
                "source_agent": msg.source_agent,
                "payload": msg.payload,
                "priority": msg.priority.name if hasattr(msg.priority, "name") else str(msg.priority),
            }},
        ]
        if self._has_provider_type("SlackWebhookProvider"):
            calls.append({"tool": "send_slack_alert", "args": {"title": "", "message": "", "severity": "medium"}})
        if self._has_provider_type("TeamsWebhookProvider"):
            calls.append({"tool": "send_teams_alert", "args": {"title": "", "message": "", "severity": "medium"}})
        if self._has_provider_type("JiraProvider"):
            calls.append({"tool": "create_jira_ticket", "args": {"title": "", "message": "", "severity": "medium"}})
        return calls

    def _has_provider_type(self, type_name: str) -> bool:
        return any(type(p).__name__ == type_name for p in self.providers)

    @traceable(name="notification_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        formatted = None
        for call in tool_calls:
            tool_name = call["tool"]
            args = call.get("args", {})
            if tool_name in ("send_slack_alert", "send_teams_alert", "create_jira_ticket") and formatted:
                args["title"] = formatted["title"]
                args["message"] = formatted["message"]
                args["severity"] = formatted["severity"]
                args["fields"] = formatted.get("fields")
            result = await self.tool_registry.execute(tool_name, **args)
            if tool_name == "format_alert_message":
                formatted = result
            results.append(result)
        return results

    @traceable(name="notification_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        sent_count = sum(1 for r in tool_results if r is True)
        return AgentObservation(
            agent_id=self.name,
            action_taken=f"notifications_sent_{sent_count}",
            confidence_score=0.9 if sent_count > 0 else 0.5,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=ObservationNextState.CONTINUE,
            metadata={"sent_count": sent_count, "total_providers": len(self.providers)},
        )

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
