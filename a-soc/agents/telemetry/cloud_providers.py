import abc
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

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
