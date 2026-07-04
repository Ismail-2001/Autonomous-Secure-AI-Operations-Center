"""Performance regression tests.

Run in CI to detect performance regressions against baseline metrics.
Baselines are stored in BENCHMARKS.md and compared after each run.
"""

import asyncio
import json
import time
from pathlib import Path

import pytest


BASELINE_FILE = Path(__file__).parent.parent.parent / "BENCHMARKS.md"
RESULTS_FILE = Path(__file__).parent / "perf-results.json"


@pytest.mark.performance
class TestAPIPerformance:
    """API endpoint performance benchmarks."""

    @pytest.mark.asyncio
    async def test_health_endpoint_latency(self, http_client):
        """Health endpoint should respond in < 100ms."""
        start = time.perf_counter()
        resp = await http_client.get("http://localhost:9002/health")
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert resp.status_code == 200
        assert elapsed_ms < 100, f"Health endpoint took {elapsed_ms:.1f}ms (target: <100ms)"
        self._record("health_latency_ms", elapsed_ms)

    @pytest.mark.asyncio
    async def test_dashboard_stats_latency(self, http_client, auth_headers):
        """Dashboard stats should respond in < 500ms."""
        start = time.perf_counter()
        resp = await http_client.get("http://localhost:9002/api/v1/dashboard/stats", headers=auth_headers)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert resp.status_code == 200
        assert elapsed_ms < 500, f"Dashboard stats took {elapsed_ms:.1f}ms (target: <500ms)"
        self._record("dashboard_stats_latency_ms", elapsed_ms)

    @pytest.mark.asyncio
    async def test_incidents_list_latency(self, http_client, auth_headers):
        """Incidents list should respond in < 500ms."""
        start = time.perf_counter()
        resp = await http_client.get("http://localhost:9002/api/v1/incidents", headers=auth_headers)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert resp.status_code == 200
        assert elapsed_ms < 500, f"Incidents list took {elapsed_ms:.1f}ms (target: <500ms)"
        self._record("incidents_list_latency_ms", elapsed_ms)

    @pytest.mark.asyncio
    async def test_hunting_events_latency(self, http_client, auth_headers):
        """Hunting events should respond in < 1000ms."""
        start = time.perf_counter()
        resp = await http_client.get("http://localhost:9002/api/v1/hunting/events?limit=50", headers=auth_headers)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert resp.status_code == 200
        assert elapsed_ms < 1000, f"Hunting events took {elapsed_ms:.1f}ms (target: <1000ms)"
        self._record("hunting_events_latency_ms", elapsed_ms)

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, http_client, auth_headers):
        """20 concurrent requests should all complete in < 5s."""
        async def make_request():
            start = time.perf_counter()
            resp = await http_client.get("http://localhost:9002/api/v1/dashboard/stats", headers=auth_headers)
            elapsed = time.perf_counter() - start
            return resp.status_code, elapsed

        start = time.perf_counter()
        results = await asyncio.gather(*[make_request() for _ in range(20)])
        total_elapsed = time.perf_counter() - start

        statuses = [r[0] for r in results]
        latencies = [r[1] * 1000 for r in results]

        assert all(s == 200 for s in statuses), f"Some requests failed: {statuses}"
        assert total_elapsed < 5, f"20 concurrent requests took {total_elapsed:.2f}s (target: <5s)"

        p50 = sorted(latencies)[len(latencies) // 2]
        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        self._record("concurrent_20_total_ms", total_elapsed * 1000)
        self._record("concurrent_20_p50_ms", p50)
        self._record("concurrent_20_p99_ms", p99)

    @staticmethod
    def _record(metric: str, value: float):
        results = {}
        if RESULTS_FILE.exists():
            results = json.loads(RESULTS_FILE.read_text())
        results[metric] = round(value, 2)
        RESULTS_FILE.write_text(json.dumps(results, indent=2))


@pytest.mark.performance
class TestRegression:
    """Compare current results against baselines."""

    def test_no_performance_regression(self):
        """Current metrics must not exceed 120% of baseline."""
        if not RESULTS_FILE.exists():
            pytest.skip("No performance results to compare")

        results = json.loads(RESULTS_FILE.read_text())
        baselines = self._parse_baselines()

        regressions = []
        for metric, value in results.items():
            if metric in baselines:
                baseline = baselines[metric]
                threshold = baseline * 1.2
                if value > threshold:
                    regressions.append(f"{metric}: {value}ms > {threshold:.0f}ms (baseline: {baseline}ms)")

        assert not regressions, "Performance regressions detected:\n" + "\n".join(regressions)

    @staticmethod
    def _parse_baselines() -> dict:
        baselines = {}
        if not BASELINE_FILE.exists():
            return baselines

        content = BASELINE_FILE.read_text()
        for line in content.split("\n"):
            if "|" in line and "ms" in line:
                parts = [p.strip() for p in line.split("|") if p.strip()]
                if len(parts) >= 2:
                    try:
                        value = float(parts[-1].replace("ms", "").replace(",", ""))
                        key = parts[0].lower().replace(" ", "_").replace("-", "_")
                        baselines[key] = value
                    except (ValueError, IndexError):
                        pass
        return baselines
