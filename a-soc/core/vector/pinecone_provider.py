import abc
import asyncio
import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.config.settings import settings

logger = logging.getLogger("asoc.vector")


@dataclass
class VectorRecord:
    id: str
    vector: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)
    score: float = 0.0


class VectorProvider(abc.ABC):
    @abc.abstractmethod
    async def upsert(self, records: List[VectorRecord]) -> bool: ...

    @abc.abstractmethod
    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]: ...

    @abc.abstractmethod
    async def delete(self, ids: List[str]) -> bool: ...

    @abc.abstractmethod
    async def health_check(self) -> bool: ...

    @abc.abstractmethod
    async def embed_text(self, text: str) -> List[float]: ...


class MockVectorProvider(VectorProvider):
    def __init__(self):
        self._store: Dict[str, VectorRecord] = {}

    async def upsert(self, records: List[VectorRecord]) -> bool:
        for r in records:
            self._store[r.id] = r
        logger.info("MockVectorProvider: upserted %d records (total: %d)", len(records), len(self._store))
        return True

    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]:
        scored = []
        for record in self._store.values():
            if filter:
                if not all(record.metadata.get(k) == v for k, v in filter.items()):
                    continue
            sim = self._cosine_similarity(vector, record.vector)
            record.score = sim
            scored.append(record)
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]

    async def delete(self, ids: List[str]) -> bool:
        for i in ids:
            self._store.pop(i, None)
        return True

    async def health_check(self) -> bool:
        return True

    async def embed_text(self, text: str) -> List[float]:
        h = hashlib.sha256(text.encode()).hexdigest()
        return [int(h[i : i + 2], 16) / 255.0 for i in range(0, min(64, len(h)), 2)]

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        if not na or not nb:
            return 0.0
        return dot / (na * nb)


class PineconeVectorProvider(VectorProvider):
    def __init__(
        self, api_key: Optional[str] = None, environment: Optional[str] = None, index_name: str = "asoc-incidents"
    ):
        self.api_key = api_key
        self.environment = environment or "us-west1-gcp"
        self.index_name = index_name
        self._index = None
        self._healthy = False
        self._pc = None

    async def _get_index(self):
        if self._index is not None:
            return self._index
        try:
            from pinecone import Pinecone, ServerlessSpec

            self._pc = Pinecone(api_key=self.api_key)

            def _init():
                if self.index_name not in self._pc.list_indexes().names():
                    self._pc.create_index(
                        name=self.index_name,
                        dimension=32,
                        metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region=self.environment),
                    )
                self._index = self._pc.Index(self.index_name)
                self._healthy = True
                logger.info("Pinecone index '%s' initialized", self.index_name)

            await asyncio.to_thread(_init)
        except Exception as e:
            logger.warning("Failed to initialize Pinecone: %s", e)
            self._healthy = False
        return self._index

    async def upsert(self, records: List[VectorRecord]) -> bool:
        index = await self._get_index()
        if index is None:
            logger.warning("Pinecone unavailable, falling back to mock upsert")
            return False
        try:
            vectors = [(r.id, r.vector, r.metadata) for r in records]
            await asyncio.to_thread(index.upsert, vectors=vectors)
            logger.info("Pinecone: upserted %d vectors", len(records))
            return True
        except Exception as e:
            logger.error("Pinecone upsert failed: %s", e)
            return False

    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]:
        index = await self._get_index()
        if index is None:
            logger.warning("Pinecone unavailable, returning empty query results")
            return []
        try:
            result = await asyncio.to_thread(
                index.query, vector=vector, top_k=top_k, filter=filter, include_metadata=True
            )
            return [
                VectorRecord(id=m.get("id", ""), vector=[], metadata=m.get("metadata", {}), score=m.get("score", 0.0))
                for m in result.get("matches", [])
            ]
        except Exception as e:
            logger.error("Pinecone query failed: %s", e)
            return []

    async def delete(self, ids: List[str]) -> bool:
        index = await self._get_index()
        if index is None:
            return False
        try:
            await asyncio.to_thread(index.delete, ids=ids)
            return True
        except Exception as e:
            logger.error("Pinecone delete failed: %s", e)
            return False

    async def health_check(self) -> bool:
        index = await self._get_index()
        if index is None:
            return False
        try:
            fn = lambda: index.describe_index_stats()
            await asyncio.to_thread(fn)
            return True
        except Exception:
            self._healthy = False
            return False

    async def embed_text(self, text: str) -> List[float]:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI()
            resp = await client.embeddings.create(input=text, model="text-embedding-ada-002")
            return resp.data[0].embedding
        except Exception as e:
            logger.warning("OpenAI embedding failed, using fallback: %s", e)
            h = hashlib.sha256(text.encode()).hexdigest()
            return [int(h[i : i + 2], 16) / 255.0 for i in range(0, min(64, len(h)), 2)]


def create_vector_provider() -> VectorProvider:
    if settings.PINECONE_API_KEY:
        return PineconeVectorProvider(
            api_key=settings.PINECONE_API_KEY.get_secret_value(),
            environment=settings.PINECONE_ENVIRONMENT,
            index_name="asoc-incidents",
        )
    logger.info("No Pinecone API key configured. Using MockVectorProvider.")
    return MockVectorProvider()


vector_provider = create_vector_provider()
