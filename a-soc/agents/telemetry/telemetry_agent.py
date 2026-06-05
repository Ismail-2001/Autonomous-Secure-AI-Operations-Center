import asyncio
from typing import Optional

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType, Priority
from agents.telemetry.cloud_providers import AWSCloudTrailProvider, BaseCloudProvider
from core.config.settings import settings


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
