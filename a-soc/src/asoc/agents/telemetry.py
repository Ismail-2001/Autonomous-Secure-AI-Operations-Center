import abc
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from langsmith import traceable

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.core.config import settings

logger = logging.getLogger("asoc.cloud_providers")


class CloudEvent:
    def __init__(
        self,
        event_id: str,
        event_name: str,
        event_time: str,
        source_ip: Optional[str],
        user_identity: Dict[str, Any],
        resources: List[Dict[str, Any]],
        raw: Dict[str, Any],
    ):
        self.event_id = event_id
        self.event_name = event_name
        self.event_time = event_time
        self.source_ip = source_ip
        self.user_identity = user_identity
        self.resources = resources
        self.raw = raw

    def to_dict(self) -> Dict[str, Any]:
        return {
            "eventID": self.event_id,
            "eventName": self.event_name,
            "eventTime": self.event_time,
            "sourceIPAddress": self.source_ip,
            "userIdentity": self.user_identity,
            "resources": self.resources,
        }

    @classmethod
    def from_cloudtrail(cls, event: Dict[str, Any]) -> "CloudEvent":
        return cls(
            event_id=event.get("EventId", ""),
            event_name=event.get("EventName", "Unknown"),
            event_time=event.get("EventTime", datetime.now(timezone.utc).isoformat()),
            source_ip=event.get("SourceIPAddress"),
            user_identity=event.get("UserIdentity", {}),
            resources=event.get("Resources", []),
            raw=event,
        )


class BaseCloudProvider(abc.ABC):
    @abc.abstractmethod
    async def fetch_events(self, max_results: int = 10, **kwargs) -> List[CloudEvent]: ...

    @abc.abstractmethod
    async def health_check(self) -> bool: ...


class AWSCloudTrailProvider(BaseCloudProvider):
    def __init__(
        self, region: str = "us-east-1", access_key_id: Optional[str] = None, secret_access_key: Optional[str] = None
    ):
        self.region = region
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self._client = None
        self._healthy = False

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            import boto3

            session_kwargs: Dict[str, Any] = {"region_name": self.region}
            if self.access_key_id and self.secret_access_key:
                session_kwargs["aws_access_key_id"] = self.access_key_id
                session_kwargs["aws_secret_access_key"] = self.secret_access_key
            session = boto3.Session(**session_kwargs)
            self._client = session.client("cloudtrail")
            self._healthy = True
            logger.info("AWS CloudTrail client initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize AWS CloudTrail client: {e}")
            self._healthy = False
        return self._client

    async def fetch_events(
        self, max_results: int = 10, start_time: Optional[datetime] = None, **kwargs
    ) -> List[CloudEvent]:
        client = self._get_client()
        if client is None:
            logger.info("No AWS CloudTrail client available, returning mock events")
            return self._mock_events(max_results)

        if start_time is None:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)

        loop = asyncio.get_event_loop()

        def _lookup() -> List[Dict[str, Any]]:
            try:
                paginator = client.get_paginator("lookup_events")
                pages = paginator.paginate(StartTime=start_time, MaxResults=max_results)
                events = []
                for page in pages:
                    for e in page.get("Events", []):
                        events.append(e)
                        if len(events) >= max_results:
                            break
                    if len(events) >= max_results:
                        break
                return events
            except Exception as e:
                logger.error(f"CloudTrail LookupEvents failed: {e}")
                return []

        raw_events = await loop.run_in_executor(None, _lookup)

        if not raw_events:
            logger.info("No CloudTrail events found, returning mock events")
            return self._mock_events(max_results)

        return [CloudEvent.from_cloudtrail(e) for e in raw_events]

    async def health_check(self) -> bool:
        client = self._get_client()
        if client is None:
            return False
        try:
            loop = asyncio.get_event_loop()

            def _check():
                client.describe_trails()
                return True

            return await loop.run_in_executor(None, _check)
        except Exception:
            self._healthy = False
            return False

    def _mock_events(self, count: int) -> List[CloudEvent]:
        mock_templates = [
            {"eventName": "ConsoleLogin", "sourceIP": "192.168.1.50", "userName": "admin"},
            {"eventName": "CreateUser", "sourceIP": "10.0.0.25", "userName": "infra-bot"},
            {"eventName": "DeleteBucket", "sourceIP": "203.0.113.42", "userName": "dev-operator"},
            {"eventName": "AuthorizeSecurityGroupIngress", "sourceIP": "72.14.192.10", "userName": "sec-admin"},
            {"eventName": "RunInstances", "sourceIP": "198.51.100.7", "userName": "ci-pipeline"},
        ]
        events = []
        for i in range(min(count, len(mock_templates))):
            t = mock_templates[i]
            event_time = (datetime.now(timezone.utc) - timedelta(minutes=i * 5)).isoformat()
            events.append(
                CloudEvent(
                    event_id=f"mock-{i}-{datetime.now(timezone.utc).timestamp()}",
                    event_name=t["eventName"],
                    event_time=event_time,
                    source_ip=t["sourceIP"],
                    user_identity={"type": "IAMUser", "userName": t["userName"]},
                    resources=[],
                    raw={"EventId": f"mock-{i}", "EventName": t["eventName"]},
                )
            )
        return events


class GCPCloudProvider(BaseCloudProvider):
    def __init__(self, project_id: Optional[str] = None, credentials_path: Optional[str] = None):
        self.project_id = project_id
        self.credentials_path = credentials_path
        self._client = None
        self._healthy = False

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from google.cloud import logging_v2

            client_kwargs: Dict[str, Any] = {}
            if self.credentials_path:
                from google.oauth2 import service_account

                credentials = service_account.Credentials.from_service_account_file(self.credentials_path)
                client_kwargs["credentials"] = credentials
            if self.project_id:
                client_kwargs["project"] = self.project_id
            self._client = logging_v2.Client(**client_kwargs)
            self._healthy = True
            logger.info("GCP Cloud Logging client initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize GCP Cloud Logging client: {e}")
            self._healthy = False
        return self._client

    async def fetch_events(
        self, max_results: int = 10, start_time: Optional[datetime] = None, **kwargs
    ) -> List[CloudEvent]:
        client = self._get_client()
        if client is None:
            logger.info("No GCP Cloud Logging client available, returning mock events")
            return self._mock_events(max_results)

        if start_time is None:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)

        loop = asyncio.get_event_loop()

        def _list_entries() -> List[Dict[str, Any]]:
            try:
                entries = client.list_entries(
                    resource_names=[f"projects/{self.project_id}"],
                    filter_=f'protoPayload.serviceName="cloudaudit.googleapis.com" AND timestamp >= "{start_time.isoformat()}Z"',
                    page_size=max_results,
                )
                results = []
                for entry in entries:
                    if len(results) >= max_results:
                        break
                    payload = entry.payload
                    if isinstance(payload, dict):
                        results.append(payload)
                    else:
                        results.append(
                            {
                                "protoPayload": payload,
                                "timestamp": (
                                    entry.timestamp.isoformat()
                                    if hasattr(entry, "timestamp")
                                    else start_time.isoformat()
                                ),
                            }
                        )
                return results
            except Exception as e:
                logger.error(f"GCP Logging list_entries failed: {e}")
                return []

        raw_entries = await loop.run_in_executor(None, _list_entries)

        if not raw_entries:
            logger.info("No GCP audit log entries found, returning mock events")
            return self._mock_events(max_results)

        return [
            CloudEvent(
                event_id=entry.get("insertId", f"gcp-{i}"),
                event_name=entry.get("protoPayload", {}).get("methodName", "Unknown"),
                event_time=entry.get("timestamp", start_time.isoformat()),
                source_ip=entry.get("protoPayload", {}).get("requestMetadata", {}).get("callerIp"),
                user_identity=entry.get("protoPayload", {}).get("authenticationInfo", {}),
                resources=[
                    {"type": r.get("type", ""), "name": r.get("name", "")}
                    for r in entry.get("protoPayload", {}).get("resourceList", [])
                ],
                raw=entry,
            )
            for i, entry in enumerate(raw_entries)
        ]

    async def health_check(self) -> bool:
        client = self._get_client()
        if client is None:
            return False
        try:
            loop = asyncio.get_event_loop()

            def _check():
                client.list_entries(page_size=1)
                return True

            return await loop.run_in_executor(None, _check)
        except Exception:
            self._healthy = False
            return False

    def _mock_events(self, count: int) -> List[CloudEvent]:
        mock_templates = [
            {"eventName": "google.iam.admin.v1.CreateServiceAccount", "sourceIP": "10.0.0.1", "userName": "admin@gcp-project"},
            {"eventName": "google.cloud.storage.v1.Storage.GetObject", "sourceIP": "203.0.113.5", "userName": "svc-account@gcp-project"},
            {"eventName": "google.cloud.compute.v1.Instances.Insert", "sourceIP": "198.51.100.2", "userName": "ci-runner@gcp-project"},
            {"eventName": "google.cloud.sql.v1.Instances.Delete", "sourceIP": "72.14.192.15", "userName": "ops-admin@gcp-project"},
            {"eventName": "google.cloud.kms.v1.KeyManagementService.Decrypt", "sourceIP": "192.168.1.99", "userName": "app-svc@gcp-project"},
        ]
        events = []
        for i in range(min(count, len(mock_templates))):
            t = mock_templates[i]
            event_time = (datetime.now(timezone.utc) - timedelta(minutes=i * 5)).isoformat()
            events.append(
                CloudEvent(
                    event_id=f"gcp-mock-{i}-{datetime.now(timezone.utc).timestamp()}",
                    event_name=t["eventName"],
                    event_time=event_time,
                    source_ip=t["sourceIP"],
                    user_identity={"type": "serviceAccount", "principalEmail": t["userName"]},
                    resources=[{"type": "audited_resource", "name": t["eventName"]}],
                    raw={"EventId": f"gcp-mock-{i}", "EventName": t["eventName"]},
                )
            )
        return events


class AzureCloudProvider(BaseCloudProvider):
    def __init__(
        self,
        tenant_id: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        subscription_id: Optional[str] = None,
    ):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.subscription_id = subscription_id
        self._client = None
        self._healthy = False

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from azure.identity import ClientSecretCredential
            from azure.monitor.query import LogsQueryClient

            credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret,
            )
            self._client = LogsQueryClient(credential=credential)
            self._healthy = True
            logger.info("Azure Logs Query client initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize Azure Logs Query client: {e}")
            self._healthy = False
        return self._client

    async def fetch_events(
        self, max_results: int = 10, start_time: Optional[datetime] = None, **kwargs
    ) -> List[CloudEvent]:
        client = self._get_client()
        if client is None:
            logger.info("No Azure Logs Query client available, returning mock events")
            return self._mock_events(max_results)

        if start_time is None:
            start_time = datetime.now(timezone.utc) - timedelta(hours=1)

        end_time = start_time + timedelta(hours=1)
        loop = asyncio.get_event_loop()
        workspace_id = kwargs.get("workspace_id", self.subscription_id or "")

        def _query() -> List[Dict[str, Any]]:
            try:
                query = (
                    f"AzureActivity "
                    f"| where TimeGenerated between (datetime({start_time.isoformat()}) .. datetime({end_time.isoformat()})) "
                    f"| project TimeGenerated, OperationName, CallerIpAddress, Caller, Resource, ActivityStatus "
                    f"| take {max_results}"
                )
                response = client.query_workspace(workspace_id, query)
                tables = response.tables
                if not tables:
                    return []
                rows = []
                for row in tables[0].rows:
                    rows.append(
                        {
                            "TimeGenerated": row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]),
                            "OperationName": str(row[1]) if len(row) > 1 else "Unknown",
                            "CallerIpAddress": str(row[2]) if len(row) > 2 and row[2] else None,
                            "Caller": str(row[3]) if len(row) > 3 else "",
                            "Resource": str(row[4]) if len(row) > 4 else "",
                            "ActivityStatus": str(row[5]) if len(row) > 5 else "Accepted",
                        }
                    )
                return rows
            except Exception as e:
                logger.error(f"Azure Log Analytics query failed: {e}")
                return []

        raw_rows = await loop.run_in_executor(None, _query)

        if not raw_rows:
            logger.info("No Azure Activity log entries found, returning mock events")
            return self._mock_events(max_results)

        return [
            CloudEvent(
                event_id=f"azure-{hash(str(row))}-{i}",
                event_name=row.get("OperationName", "Unknown"),
                event_time=row.get("TimeGenerated", start_time.isoformat()),
                source_ip=row.get("CallerIpAddress"),
                user_identity={"type": "AzureAD", "principalName": row.get("Caller", "")},
                resources=[{"type": "AzureResource", "name": row.get("Resource", "")}],
                raw=row,
            )
            for i, row in enumerate(raw_rows)
        ]

    async def health_check(self) -> bool:
        client = self._get_client()
        if client is None:
            return False
        try:
            loop = asyncio.get_event_loop()

            def _check():
                client.query_workspace(self.subscription_id or "", "AzureActivity | take 1")
                return True

            return await loop.run_in_executor(None, _check)
        except Exception:
            self._healthy = False
            return False

    def _mock_events(self, count: int) -> List[CloudEvent]:
        mock_templates = [
            {"eventName": "MICROSOFT.COMPUTE/VIRTUALMACHINES/WRITE", "sourceIP": "10.0.0.1", "userName": "admin@contoso.com"},
            {"eventName": "MICROSOFT.STORAGE/STORAGEACCOUNTS/LISTKEYS/ACTION", "sourceIP": "203.0.113.5", "userName": "svc-account@contoso.com"},
            {"eventName": "MICROSOFT.AUTHORIZATION/ROLEASSIGNMENTS/WRITE", "sourceIP": "198.51.100.2", "userName": "sec-admin@contoso.com"},
            {"eventName": "MICROSOFT.SECURITY/ALERTS/WRITE", "sourceIP": "72.14.192.15", "userName": "soc-analyst@contoso.com"},
            {"eventName": "MICROSOFT.NETWORK/NETWORKSECURITYGROUPS/DELETE", "sourceIP": "192.168.1.99", "userName": "infra-bot@contoso.com"},
        ]
        events = []
        for i in range(min(count, len(mock_templates))):
            t = mock_templates[i]
            event_time = (datetime.now(timezone.utc) - timedelta(minutes=i * 5)).isoformat()
            events.append(
                CloudEvent(
                    event_id=f"azure-mock-{i}-{datetime.now(timezone.utc).timestamp()}",
                    event_name=t["eventName"],
                    event_time=event_time,
                    source_ip=t["sourceIP"],
                    user_identity={"type": "AzureAD", "principalName": t["userName"]},
                    resources=[{"type": "AzureResource", "name": t["eventName"]}],
                    raw={"EventId": f"azure-mock-{i}", "EventName": t["eventName"]},
                )
            )
        return events


class TelemetryAgent(BaseAgent):
    def __init__(self, provider: Optional[BaseCloudProvider] = None):
        super().__init__(
            name="TelemetryAgent", description="Pulls logs from AWS CloudTrail, VPC Flow Logs, and K8s audit logs"
        )
        if provider:
            self.provider = provider
        else:
            aws_key = settings.AWS_ACCESS_KEY_ID.get_secret_value() if settings.AWS_ACCESS_KEY_ID else None
            aws_secret = settings.AWS_SECRET_ACCESS_KEY.get_secret_value() if settings.AWS_SECRET_ACCESS_KEY else None
            self.provider = AWSCloudTrailProvider(
                region=settings.AWS_REGION,
                access_key_id=aws_key,
                secret_access_key=aws_secret,
            )

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="fetch_cloud_events",
            func=self._tool_fetch_cloud_events,
            description="Fetch cloud audit events from configured provider (AWS/GCP/Azure)",
            input_schema={"max_results": {"type": "integer", "default": 10}},
            output_schema={"events": {"type": "array"}},
        )
        self.tool_registry.register(
            name="filter_events_by_risk",
            func=self._tool_filter_events_by_risk,
            description="Pre-filter events by risk heuristic based on event type",
            input_schema={"events": {"type": "array"}, "min_risk": {"type": "number"}},
            output_schema={"filtered_events": {"type": "array"}},
        )
        self.tool_registry.register(
            name="normalize_event_schema",
            func=self._tool_normalize_event,
            description="Normalize raw cloud event to standard CloudEvent schema",
            input_schema={"raw_event": {"type": "object"}},
            output_schema={"normalized_event": {"type": "object"}},
        )
        self.tool_registry.register(
            name="emit_telemetry_alert",
            func=self._tool_emit_alert,
            description="Publish telemetry alert to the message bus",
            input_schema={"event": {"type": "object"}, "priority": {"type": "string"}},
        )

    async def _tool_fetch_cloud_events(self, max_results: int = 10) -> List[Dict[str, Any]]:
        events = await self.provider.fetch_events(max_results=max_results)
        return [e.to_dict() for e in events]

    async def _tool_filter_events_by_risk(self, events: List[Dict[str, Any]], min_risk: float = 0.3) -> List[Dict[str, Any]]:
        HIGH_RISK_EVENTS = {
            "ConsoleLogin", "CreateUser", "DeleteBucket",
            "AuthorizeSecurityGroupIngress", "TerminateInstance",
        }
        filtered = []
        for event in events:
            name = event.get("eventName", event.get("EventName", ""))
            risk = 0.8 if name in HIGH_RISK_EVENTS else 0.3
            if risk >= min_risk:
                event["_risk_heuristic"] = risk
                filtered.append(event)
        return filtered

    async def _tool_normalize_event(self, raw_event: Dict[str, Any]) -> Dict[str, Any]:
        return CloudEvent.from_cloudtrail(raw_event).to_dict()

    async def _tool_emit_alert(self, event: Dict[str, Any], priority: str = "medium") -> bool:
        priority_map = {"low": Priority.LOW, "medium": Priority.MEDIUM, "high": Priority.HIGH, "critical": Priority.CRITICAL}
        msg = ASOCMessage(
            message_type=MessageType.ALERT,
            source_agent=self.name,
            payload={"event": event, "provider": "aws_cloudtrail"},
            priority=priority_map.get(priority, Priority.MEDIUM),
        )
        await self.send_message(msg)
        await self.log_event("log_ingestion", {"event_id": event.get("eventID", ""), "event_name": event.get("eventName", "")})
        return True

    @traceable(name="telemetry_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        return {"provider_healthy": await self.provider.health_check(), "has_existing_events": bool(state.get("working_memory", {}).get("events"))}

    @traceable(name="telemetry_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        calls = [{"tool": "fetch_cloud_events", "args": {"max_results": 5}}]
        if perceived.get("has_existing_events"):
            calls.append({"tool": "filter_events_by_risk", "args": {"events": state["working_memory"]["events"], "min_risk": 0.3}})
        return calls

    @traceable(name="telemetry_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        for call in tool_calls:
            result = await self.tool_registry.execute(call["tool"], **call.get("args", {}))
            results.append(result)
        return results

    @traceable(name="telemetry_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        events = []
        for r in tool_results:
            if isinstance(r, list):
                events.extend(r)
            elif isinstance(r, dict):
                events.append(r)

        has_events = len(events) > 0
        return AgentObservation(
            agent_id=self.name,
            action_taken="fetched_cloud_events" if has_events else "no_events_found",
            confidence_score=0.9 if has_events else 0.3,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=ObservationNextState.CONTINUE if has_events else ObservationNextState.HALT,
            metadata={"event_count": len(events), "events": events[:5]},
        )

    async def poll_cloudtrail(self) -> Optional[ASOCMessage]:
        self.logger.info("Polling CloudTrail for new events...")
        try:
            events = await self.provider.fetch_events(max_results=5)
            if not events:
                self.logger.info("No events returned from provider")
                return None

            for event in events:
                message = ASOCMessage(
                    message_type=MessageType.ALERT,
                    source_agent=self.name,
                    payload={"event": event.to_dict(), "provider": "aws_cloudtrail"},
                    priority=Priority.MEDIUM,
                )
                await self.send_message(message)
                await self.log_event(
                    "log_ingestion",
                    {"event_id": event.event_id, "event_name": event.event_name, "source": "cloudtrail"},
                )
                self.logger.info(f"Ingested event: {event.event_name} ({event.event_id})")

            return ASOCMessage(
                message_type=MessageType.ALERT,
                source_agent=self.name,
                payload={"events": [e.to_dict() for e in events], "provider": "aws_cloudtrail"},
                priority=Priority.MEDIUM,
            )
        except Exception as e:
            self.logger.error(f"Error polling CloudTrail: {str(e)}")
            return None

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.COMMAND:
            if message.payload.get("action") == "start_polling":
                asyncio.create_task(self.poll_cloudtrail())
        return None
