import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

import redis.asyncio as aioredis

from core.logging import StructuredLogger, get_logger

logger = get_logger("asoc.message_bus")

STREAM_PREFIX = "asoc:agent:"
CONSUMER_GROUP = "asoc-agents"
MAXLEN = 10000


class MessageBus:
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self._redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None
        self._consumers: Dict[str, asyncio.Task] = {}
        self._handlers: Dict[str, List[Callable]] = {}
        self._consumer_id = str(uuid.uuid4())[:8]

    async def connect(self) -> None:
        self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        logger.info("message_bus_connected", redis_url=self._redis_url)

    async def close(self) -> None:
        for task in self._consumers.values():
            task.cancel()
        if self._consumers:
            await asyncio.gather(*self._consumers.values(), return_exceptions=True)
        if self._redis:
            await self._redis.close()
        logger.info("message_bus_disconnected")

    async def publish(self, topic: str, message: Dict[str, Any]) -> str:
        if self._redis is None:
            await self.connect()
        msg_id = str(uuid.uuid4())
        payload = {
            "id": msg_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "topic": topic,
            "data": json.dumps(message, default=str),
        }
        stream = f"{STREAM_PREFIX}{topic}"
        await self._redis.xadd(stream, payload, maxlen=MAXLEN)
        logger.debug("message_published", topic=topic, msg_id=msg_id)
        return msg_id

    async def subscribe(self, topic: str, handler: Callable, batch_size: int = 10) -> None:
        if self._redis is None:
            await self.connect()

        stream = f"{STREAM_PREFIX}{topic}"

        try:
            await self._redis.xgroup_create(stream, CONSUMER_GROUP, id="0", mkstream=True)
        except aioredis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

        consumer_name = f"{self._consumer_id}-{topic}"

        async def _poll():
            logger.info("consumer_started", topic=topic)
            while True:
                try:
                    results = await self._redis.xreadgroup(
                        CONSUMER_GROUP, consumer_name, {stream: ">"}, count=batch_size, block=2000
                    )
                    if not results:
                        continue
                    for _, messages in results:
                        for msg_id, fields in messages:
                            try:
                                data = json.loads(fields.get("data", "{}"))
                                handler(data)
                                await self._redis.xack(stream, CONSUMER_GROUP, msg_id)
                            except Exception as e:
                                logger.error("consumer_handler_failed", topic=topic, msg_id=msg_id, error=str(e))
                except aioredis.ConnectionError:
                    logger.warning("consumer_reconnecting", topic=topic)
                    await asyncio.sleep(1)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error("consumer_error", topic=topic, error=str(e))
                    await asyncio.sleep(1)

        task = asyncio.create_task(_poll())
        self._consumers[topic] = task

    async def health_check(self) -> bool:
        if self._redis is None:
            return False
        try:
            await self._redis.ping()
            return True
        except Exception:
            return False


_bus: Optional[MessageBus] = None
_bus_lock = asyncio.Lock()


async def get_message_bus() -> MessageBus:
    global _bus
    if _bus is None:
        async with _bus_lock:
            if _bus is None:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                _bus = MessageBus(redis_url)
                await _bus.connect()
    return _bus


async def close_message_bus() -> None:
    global _bus
    if _bus:
        await _bus.close()
        _bus = None
