import abc
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
    def embed_text(self, text: str) -> List[float]: ...


class MockVectorProvider(VectorProvider):
    def __init__(self):
        self._store: Dict[str, VectorRecord] = {}

    async def upsert(self, records: List[VectorRecord]) -> bool:
        for r in records:
            self._store[r.id] = r
        logger.info(f"MockVectorProvider: upserted {len(records)} records (total: {len(self._store)})")
        return True

    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]:
        scored = []
        for record in self._store.values():
            if filter:
                matched = all(record.metadata.get(k) == v for k, v in filter.items())
                if not matched:
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

    def embed_text(self, text: str) -> List[float]:
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
        self,
        api_key: Optional[str] = None,
        environment: Optional[str] = None,
        index_name: str = "asoc-incidents",
    ):
        self.api_key = api_key
        self.environment = environment or "us-west1-gcp"
        self.index_name = index_name
        self._index = None
        self._healthy = False

    def _get_index(self):
        if self._index is not None:
            return self._index
        try:
            from pinecone import Pinecone, ServerlessSpec

            pc = Pinecone(api_key=self.api_key)
            if self.index_name not in pc.list_indexes().names():
                pc.create_index(
                    name=self.index_name,
                    dimension=32,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region=self.environment),
                )
            self._index = pc.Index(self.index_name)
            self._healthy = True
            logger.info(f"Pinecone index '{self.index_name}' initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Pinecone: {e}")
            self._healthy = False
        return self._index

    async def upsert(self, records: List[VectorRecord]) -> bool:
        index = self._get_index()
        if index is None:
            logger.warning("Pinecone unavailable, falling back to mock upsert")
            return False
        try:
            vectors = [(r.id, r.vector, r.metadata) for r in records]
            loop = self._get_event_loop()
            await loop.run_in_executor(None, lambda: index.upsert(vectors=vectors))
            logger.info(f"Pinecone: upserted {len(records)} vectors")
            return True
        except Exception as e:
            logger.error(f"Pinecone upsert failed: {e}")
            return False

    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]:
        index = self._get_index()
        if index is None:
            logger.warning("Pinecone unavailable, returning empty query results")
            return []
        try:
            loop = self._get_event_loop()

            def _query():
                return index.query(vector=vector, top_k=top_k, filter=filter, include_metadata=True)

            result = await loop.run_in_executor(None, _query)
            return [
                VectorRecord(
                    id=m.get("id", ""),
                    vector=[],
                    metadata=m.get("metadata", {}),
                    score=m.get("score", 0.0),
                )
                for m in result.get("matches", [])
            ]
        except Exception as e:
            logger.error(f"Pinecone query failed: {e}")
            return []

    async def delete(self, ids: List[str]) -> bool:
        index = self._get_index()
        if index is None:
            return False
        try:
            loop = self._get_event_loop()
            await loop.run_in_executor(None, lambda: index.delete(ids=ids))
            return True
        except Exception as e:
            logger.error(f"Pinecone delete failed: {e}")
            return False

    async def health_check(self) -> bool:
        index = self._get_index()
        if index is None:
            return False
        try:
            loop = self._get_event_loop()
            await loop.run_in_executor(None, lambda: index.describe_index_stats())
            return True
        except Exception:
            self._healthy = False
            return False

    def embed_text(self, text: str) -> List[float]:
        try:
            from langchain_openai import OpenAIEmbeddings

            embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
            return embeddings.embed_query(text)
        except Exception as e:
            logger.warning(f"OpenAI embedding failed, using fallback: {e}")
            h = hashlib.sha256(text.encode()).hexdigest()
            return [int(h[i : i + 2], 16) / 255.0 for i in range(0, min(64, len(h)), 2)]

    @staticmethod
    def _get_event_loop():
        import asyncio

        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.new_event_loop()


def create_vector_provider() -> VectorProvider:
    if settings.PINECONE_API_KEY:
        return PineconeVectorProvider(
            api_key=settings.PINECONE_API_KEY.get_secret_value(),
            environment=settings.PINECONE_ENVIRONMENT,
            index_name="asoc-incidents",
        )
    logger.info("No Pinecone API key configured. Using MockVectorProvider.")
    return MockVectorProvider()


# Singleton
vector_provider = create_vector_provider()
