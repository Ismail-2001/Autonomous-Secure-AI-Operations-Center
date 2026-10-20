from unittest.mock import patch

import pytest

from core.vector.pinecone_provider import (
    MockVectorProvider,
    PineconeVectorProvider,
    VectorProvider,
    VectorRecord,
    create_vector_provider,
    vector_provider,
)


class TestVectorRecord:
    def test_default_metadata_empty(self):
        r = VectorRecord(id="test-1", vector=[0.1, 0.2])
        assert r.metadata == {}
        assert r.score == 0.0

    def test_with_metadata(self):
        r = VectorRecord(id="test-1", vector=[0.1, 0.2], metadata={"key": "val"}, score=0.95)
        assert r.metadata["key"] == "val"
        assert r.score == 0.95


class TestMockVectorProvider:
    def setup_method(self):
        self.provider = MockVectorProvider()

    @pytest.mark.asyncio
    async def test_upsert_and_query(self):
        r = VectorRecord(id="inc-001", vector=[0.5, 0.5, 0.5], metadata={"root_cause": "phishing"})
        ok = await self.provider.upsert([r])
        assert ok is True

        results = await self.provider.query([0.5, 0.5, 0.5], top_k=5)
        assert len(results) == 1
        assert results[0].id == "inc-001"
        assert results[0].score > 0.99

    @pytest.mark.asyncio
    async def test_query_returns_top_k(self):
        for i in range(10):
            await self.provider.upsert([VectorRecord(id=f"inc-{i:03d}", vector=[0.1 * i, 0.2 * i], metadata={})])

        results = await self.provider.query([0.5, 0.5], top_k=3)
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_query_empty_store(self):
        results = await self.provider.query([0.1, 0.2], top_k=5)
        assert results == []

    @pytest.mark.asyncio
    async def test_query_with_filter_match(self):
        await self.provider.upsert(
            [
                VectorRecord(id="inc-001", vector=[0.1, 0.2], metadata={"tactic": "initial-access"}),
                VectorRecord(id="inc-002", vector=[0.3, 0.4], metadata={"tactic": "exfiltration"}),
            ]
        )
        results = await self.provider.query([0.1, 0.2], top_k=5, filter={"tactic": "exfiltration"})
        assert len(results) == 1
        assert results[0].id == "inc-002"

    @pytest.mark.asyncio
    async def test_query_with_filter_no_match(self):
        await self.provider.upsert(
            [VectorRecord(id="inc-001", vector=[0.1, 0.2], metadata={"tactic": "initial-access"})]
        )
        results = await self.provider.query([0.1, 0.2], top_k=5, filter={"tactic": "impact"})
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_delete(self):
        await self.provider.upsert([VectorRecord(id="inc-001", vector=[0.1, 0.2])])
        ok = await self.provider.delete(["inc-001"])
        assert ok is True
        results = await self.provider.query([0.1, 0.2])
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self):
        ok = await self.provider.delete(["nonexistent"])
        assert ok is True

    @pytest.mark.asyncio
    async def test_health_check(self):
        healthy = await self.provider.health_check()
        assert healthy is True

    @pytest.mark.asyncio
    async def test_embed_text_returns_32_dims(self):
        vec = await self.provider.embed_text("ConsoleLogin from unusual IP")
        assert len(vec) == 32
        assert all(isinstance(v, float) for v in vec)

    @pytest.mark.asyncio
    async def test_embed_text_deterministic(self):
        v1 = await self.provider.embed_text("test input")
        v2 = await self.provider.embed_text("test input")
        assert v1 == v2

    @pytest.mark.asyncio
    async def test_embed_text_different_inputs(self):
        v1 = await self.provider.embed_text("hello world")
        v2 = await self.provider.embed_text("different input")
        assert v1 != v2

    def test_cosine_similarity_identical(self):
        sim = self.provider._cosine_similarity([1.0, 0.0], [1.0, 0.0])
        assert sim == 1.0

    def test_cosine_similarity_orthogonal(self):
        sim = self.provider._cosine_similarity([1.0, 0.0], [0.0, 1.0])
        assert sim == 0.0

    def test_cosine_similarity_empty(self):
        sim = self.provider._cosine_similarity([], [])
        assert sim == 0.0

    def test_cosine_similarity_zero_vector(self):
        sim = self.provider._cosine_similarity([0.0, 0.0], [1.0, 0.0])
        assert sim == 0.0


@pytest.mark.asyncio
class TestPineconeVectorProvider:
    async def test_health_check_false_without_client(self):
        provider = PineconeVectorProvider()
        healthy = await provider.health_check()
        assert healthy is False

    async def test_upsert_fallback_when_no_client(self):
        provider = PineconeVectorProvider()
        ok = await provider.upsert([VectorRecord(id="test", vector=[0.1, 0.2])])
        assert ok is False

    async def test_query_empty_when_no_client(self):
        provider = PineconeVectorProvider()
        results = await provider.query([0.1, 0.2])
        assert results == []

    async def test_delete_false_when_no_client(self):
        provider = PineconeVectorProvider()
        ok = await provider.delete(["test"])
        assert ok is False

    async def test_embed_text_returns_list(self):
        provider = PineconeVectorProvider()
        vec = await provider.embed_text("test")
        assert isinstance(vec, list)
        assert len(vec) > 0


class TestCreateVectorProvider:
    def test_singleton_exists(self):
        assert vector_provider is not None
        assert isinstance(vector_provider, VectorProvider)

    def test_create_without_key_returns_mock(self):
        with patch("core.vector.pinecone_provider.settings.PINECONE_API_KEY", None):
            provider = create_vector_provider()
            assert isinstance(provider, MockVectorProvider)

    def test_create_with_key_returns_pinecone(self):
        from pydantic import SecretStr

        with patch("core.vector.pinecone_provider.settings.PINECONE_API_KEY", SecretStr("fake-key")):
            provider = create_vector_provider()
            assert isinstance(provider, PineconeVectorProvider)
