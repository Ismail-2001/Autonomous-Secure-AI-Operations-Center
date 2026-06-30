from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from src.asoc.core.config import settings

logger = logging.getLogger("asoc.vector.stores")


class StoreNamespace(str, Enum):
    THREAT_INTEL = "threat-intelligence"
    INCIDENT_HISTORY = "incident-history"
    POLICY_CONTEXT = "policy-context"


@dataclass
class StoreConfig:
    namespace: StoreNamespace
    dimension: int
    embedding_model: str
    similarity_threshold: float
    metric: str = "cosine"
    description: str = ""

    @property
    def namespace_str(self) -> str:
        return self.namespace.value


STORE_CONFIGS = {
    StoreNamespace.THREAT_INTEL: StoreConfig(
        namespace=StoreNamespace.THREAT_INTEL,
        dimension=384,
        embedding_model="text-embedding-3-small",
        similarity_threshold=0.78,
        description="Known attack signatures, MITRE ATT&CK techniques, IOCs, and threat actor TTPs",
    ),
    StoreNamespace.INCIDENT_HISTORY: StoreConfig(
        namespace=StoreNamespace.INCIDENT_HISTORY,
        dimension=384,
        embedding_model="text-embedding-3-small",
        similarity_threshold=0.72,
        description="Past incident reports, forensics analyses, and remediation outcomes",
    ),
    StoreNamespace.POLICY_CONTEXT: StoreConfig(
        namespace=StoreNamespace.POLICY_CONTEXT,
        dimension=384,
        embedding_model="text-embedding-3-small",
        similarity_threshold=0.80,
        description="OPA Rego policy rules, compliance frameworks, and decision logic",
    ),
}


@dataclass
class VectorRecord:
    id: str
    vector: List[float]
    namespace: StoreNamespace
    metadata: Dict[str, Any] = field(default_factory=dict)
    score: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ThreatIntelRecord:
    def __init__(
        self,
        technique_id: str,
        technique_name: str,
        tactic: str,
        description: str,
        indicators: Optional[List[str]] = None,
        severity: str = "medium",
        source: str = "mitre",
    ):
        self.technique_id = technique_id
        self.technique_name = technique_name
        self.tactic = tactic
        self.description = description
        self.indicators = indicators or []
        self.severity = severity
        self.source = source

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "technique_id": self.technique_id,
            "technique_name": self.technique_name,
            "tactic": self.tactic,
            "description": self.description,
            "indicators": json.dumps(self.indicators),
            "severity": self.severity,
            "source": self.source,
            "type": "threat_intel",
        }

    def to_embedding_text(self) -> str:
        return f"{self.technique_id} {self.technique_name} {self.tactic} {self.description} {' '.join(self.indicators)}"


class IncidentRecord:
    def __init__(
        self,
        incident_id: str,
        root_cause: str,
        impact_level: str,
        timeline: List[Dict[str, Any]],
        remediation_actions: List[str],
        affected_resources: List[str],
        risk_score: float,
    ):
        self.incident_id = incident_id
        self.root_cause = root_cause
        self.impact_level = impact_level
        self.timeline = timeline
        self.remediation_actions = remediation_actions
        self.affected_resources = affected_resources
        self.risk_score = risk_score

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "root_cause": self.root_cause,
            "impact_level": self.impact_level,
            "timeline_steps": len(self.timeline),
            "remediation_actions": json.dumps(self.remediation_actions),
            "affected_resources": json.dumps(self.affected_resources),
            "risk_score": self.risk_score,
            "type": "incident_history",
        }

    def to_embedding_text(self) -> str:
        return (
            f"{self.incident_id} {self.root_cause} {self.impact_level} "
            f"{' '.join(self.remediation_actions)} {' '.join(self.affected_resources)}"
        )


class PolicyRecord:
    def __init__(
        self,
        policy_id: str,
        policy_name: str,
        framework: str,
        rule_logic: str,
        controls: List[str],
        risk_threshold: float,
    ):
        self.policy_id = policy_id
        self.policy_name = policy_name
        self.framework = framework
        self.rule_logic = rule_logic
        self.controls = controls
        self.risk_threshold = risk_threshold

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "policy_id": self.policy_id,
            "policy_name": self.policy_name,
            "framework": self.framework,
            "rule_logic": self.rule_logic,
            "controls": json.dumps(self.controls),
            "risk_threshold": self.risk_threshold,
            "type": "policy_context",
        }

    def to_embedding_text(self) -> str:
        return f"{self.policy_id} {self.policy_name} {self.framework} {self.rule_logic} {' '.join(self.controls)}"


class MockStore:
    """In-memory mock store for development and testing."""

    def __init__(self, config: StoreConfig):
        self.config = config
        self._records: Dict[str, VectorRecord] = {}

    async def upsert(self, records: List[VectorRecord]) -> int:
        count = 0
        for r in records:
            self._records[r.id] = r
            count += 1
        return count

    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]:
        scored = []
        for record in self._records.values():
            if filter and not all(record.metadata.get(k) == v for k, v in filter.items()):
                continue
            sim = self._cosine(vector, record.vector)
            if sim >= self.config.similarity_threshold:
                record.score = sim
                scored.append(record)
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]

    async def delete(self, ids: List[str]) -> int:
        count = 0
        for i in ids:
            if i in self._records:
                del self._records[i]
                count += 1
        return count

    async def count(self) -> int:
        return len(self._records)

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        return dot / (na * nb) if na and nb else 0.0


class PineconeStore:
    """Real Pinecone-backed store for production."""

    def __init__(self, config: StoreConfig, api_key: str, index_name: str = "asoc-vector"):
        self.config = config
        self.api_key = api_key
        self.index_name = index_name
        self._index = None
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
                        dimension=self.config.dimension,
                        metric=self.config.metric,
                        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                    )
                self._index = self._pc.Index(self.index_name)

            await asyncio.to_thread(_init)
            return self._index
        except Exception as e:
            logger.error("pinecone_init_failed", store=self.config.namespace.value, error=str(e))
            return None

    async def upsert(self, records: List[VectorRecord]) -> int:
        index = await self._get_index()
        if index is None:
            return 0
        try:
            vectors = [
                (r.id, r.vector, {**r.metadata, "namespace": r.namespace.value, "created_at": r.created_at})
                for r in records
            ]

            def _upsert():
                index.upsert(vectors=vectors, namespace=self.config.namespace_str)

            await asyncio.to_thread(_upsert)
            return len(records)
        except Exception as e:
            logger.error("pinecone_upsert_failed", store=self.config.namespace.value, error=str(e))
            return 0

    async def query(
        self, vector: List[float], top_k: int = 5, filter: Optional[Dict[str, Any]] = None
    ) -> List[VectorRecord]:
        index = await self._get_index()
        if index is None:
            return []
        try:

            def _query():
                return index.query(
                    vector=vector,
                    top_k=top_k,
                    namespace=self.config.namespace_str,
                    filter=filter,
                    include_metadata=True,
                )

            result = await asyncio.to_thread(_query)
            records = []
            for match in result.get("matches", []):
                score = match.get("score", 0.0)
                if score >= self.config.similarity_threshold:
                    records.append(
                        VectorRecord(
                            id=match.get("id", ""),
                            vector=[],
                            namespace=self.config.namespace,
                            metadata=match.get("metadata", {}),
                            score=score,
                        )
                    )
            return records
        except Exception as e:
            logger.error("pinecone_query_failed", store=self.config.namespace.value, error=str(e))
            return []

    async def delete(self, ids: List[str]) -> int:
        index = await self._get_index()
        if index is None:
            return 0
        try:

            def _delete():
                index.delete(ids=ids, namespace=self.config.namespace_str)

            await asyncio.to_thread(_delete)
            return len(ids)
        except Exception as e:
            logger.error("pinecone_delete_failed", store=self.config.namespace.value, error=str(e))
            return 0

    async def count(self) -> int:
        index = await self._get_index()
        if index is None:
            return 0
        try:

            def _stats():
                stats = index.describe_index_stats()
                ns = stats.get("namespaces", {}).get(self.config.namespace_str, {})
                return ns.get("vector_count", 0)

            return await asyncio.to_thread(_stats)
        except Exception:
            return 0


class VectorStoreManager:
    """Manages all three vector stores with unified interface."""

    def __init__(self):
        self._stores: Dict[StoreNamespace, Any] = {}
        self._embedder = None

    def _get_store(self, namespace: StoreNamespace) -> Any:
        if namespace not in self._stores:
            config = STORE_CONFIGS[namespace]
            if settings.PINECONE_API_KEY:
                self._stores[namespace] = PineconeStore(
                    config=config,
                    api_key=settings.PINECONE_API_KEY.get_secret_value(),
                    index_name="asoc-vector",
                )
            else:
                self._stores[namespace] = MockStore(config)
        return self._stores[namespace]

    async def _embed_text(self, text: str) -> List[float]:
        if self._embedder is None:
            try:
                from openai import AsyncOpenAI

                self._embedder = AsyncOpenAI()
            except Exception:
                self._embedder = "fallback"

        if self._embedder == "fallback":
            return self._fallback_embed(text)

        try:
            config = STORE_CONFIGS[StoreNamespace.THREAT_INTEL]
            resp = await self._embedder.embeddings.create(input=text, model=config.embedding_model)
            return resp.data[0].embedding
        except Exception as e:
            logger.warning("embedding_failed_fallback", error=str(e))
            return self._fallback_embed(text)

    @staticmethod
    def _fallback_embed(text: str, dim: int = 384) -> List[float]:
        words = text.lower().split()
        if not words:
            return [0.0] * dim
        vec = [0.0] * dim
        for word in words:
            h = 14695981039346656037
            for b in word.encode():
                h ^= b
                h *= 1099511628211
                h &= 0xFFFFFFFFFFFFFFFF
            for i in range(dim):
                vec[i] += ((h >> (i * 4)) & 0xFF) / 255.0
        return [round(v / len(words), 6) for v in vec]

    async def ingest_threat_intel(self, records: List[ThreatIntelRecord]) -> int:
        store = self._get_store(StoreNamespace.THREAT_INTEL)
        vectors = []
        for r in records:
            embedding = await self._embed_text(r.to_embedding_text())
            vectors.append(VectorRecord(
                id=r.technique_id,
                vector=embedding,
                namespace=StoreNamespace.THREAT_INTEL,
                metadata=r.to_metadata(),
            ))
        return await store.upsert(vectors)

    async def ingest_incident(self, record: IncidentRecord) -> int:
        store = self._get_store(StoreNamespace.INCIDENT_HISTORY)
        embedding = await self._embed_text(record.to_embedding_text())
        return await store.upsert([VectorRecord(
            id=record.incident_id,
            vector=embedding,
            namespace=StoreNamespace.INCIDENT_HISTORY,
            metadata=record.to_metadata(),
        )])

    async def ingest_policy(self, record: PolicyRecord) -> int:
        store = self._get_store(StoreNamespace.POLICY_CONTEXT)
        embedding = await self._embed_text(record.to_embedding_text())
        return await store.upsert([VectorRecord(
            id=record.policy_id,
            vector=embedding,
            namespace=StoreNamespace.POLICY_CONTEXT,
            metadata=record.to_metadata(),
        )])

    async def search_threats(self, query: str, top_k: int = 5) -> List[VectorRecord]:
        store = self._get_store(StoreNamespace.THREAT_INTEL)
        embedding = await self._embed_text(query)
        return await store.query(embedding, top_k=top_k)

    async def search_similar_incidents(self, query: str, top_k: int = 5) -> List[VectorRecord]:
        store = self._get_store(StoreNamespace.INCIDENT_HISTORY)
        embedding = await self._embed_text(query)
        return await store.query(embedding, top_k=top_k)

    async def search_policies(self, query: str, top_k: int = 5) -> List[VectorRecord]:
        store = self._get_store(StoreNamespace.POLICY_CONTEXT)
        embedding = await self._embed_text(query)
        return await store.query(embedding, top_k=top_k)

    async def get_store_counts(self) -> Dict[str, int]:
        counts = {}
        for ns in StoreNamespace:
            store = self._get_store(ns)
            counts[ns.value] = await store.count()
        return counts

    def get_config(self, namespace: StoreNamespace) -> StoreConfig:
        return STORE_CONFIGS[namespace]


store_manager = VectorStoreManager()
