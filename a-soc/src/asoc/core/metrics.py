"""Metrics collection for A-SOC agents and operations.

Provides Prometheus-compatible metrics without requiring the prometheus library.
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class MetricPoint:
    """Single metric data point."""

    name: str
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class MetricsCollector:
    """In-memory metrics collector with histogram, counter, and gauge support."""

    def __init__(self) -> None:
        self._counters: Dict[str, float] = defaultdict(float)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        self._labels: Dict[str, Dict[str, str]] = {}

    def inc_counter(self, name: str, value: float = 1.0, **labels: str) -> None:
        """Increment a counter."""
        key = self._key(name, labels)
        self._counters[key] += value

    def set_gauge(self, name: str, value: float, **labels: str) -> None:
        """Set a gauge value."""
        key = self._key(name, labels)
        self._gauges[key] = value
        self._labels[key] = labels

    def observe_histogram(self, name: str, value: float, **labels: str) -> None:
        """Record a histogram observation."""
        key = self._key(name, labels)
        self._histograms[key].append(value)

    def get_counter(self, name: str, **labels: str) -> float:
        key = self._key(name, labels)
        return self._counters.get(key, 0.0)

    def get_gauge(self, name: str, **labels: str) -> Optional[float]:
        key = self._key(name, labels)
        return self._gauges.get(key)

    def get_histogram_stats(self, name: str, **labels: str) -> Dict[str, float]:
        key = self._key(name, labels)
        values = self._histograms.get(key, [])
        if not values:
            return {"count": 0, "sum": 0, "avg": 0, "min": 0, "max": 0, "p50": 0, "p95": 0, "p99": 0}

        sorted_vals = sorted(values)
        count = len(sorted_vals)
        return {
            "count": count,
            "sum": sum(sorted_vals),
            "avg": sum(sorted_vals) / count,
            "min": sorted_vals[0],
            "max": sorted_vals[-1],
            "p50": sorted_vals[count // 2],
            "p95": sorted_vals[int(count * 0.95)] if count >= 20 else sorted_vals[-1],
            "p99": sorted_vals[int(count * 0.99)] if count >= 100 else sorted_vals[-1],
        }

    def export_all(self) -> Dict[str, any]:
        """Export all metrics as a dictionary."""
        return {
            "counters": dict(self._counters),
            "gauges": dict(self._gauges),
            "histograms": {
                name: self.get_histogram_stats(name)
                for name in self._histograms
            },
        }

    @staticmethod
    def _key(name: str, labels: Dict[str, str]) -> str:
        if labels:
            label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
            return f"{name}{{{label_str}}}"
        return name


# Singleton
_metrics = MetricsCollector()


def get_metrics() -> MetricsCollector:
    return _metrics
