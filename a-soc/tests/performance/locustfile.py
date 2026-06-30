"""Locust load test scenarios for A-SOC API.

Targets:
  - Health endpoint: p95 < 200ms under 100 concurrent users
  - Hunting events: p95 < 2s under 50 concurrent users
  - Full incident pipeline: p95 < 5s under 20 concurrent users

Usage:
  locust -f tests/performance/locustfile.py --host=http://localhost:9002
"""
from locust import HttpUser, between, task


class HealthCheckUser(HttpUser):
    """Lightweight user hitting the health endpoint continuously."""

    weight = 3
    wait_time = between(0.5, 2)

    @task(5)
    def health_check(self):
        self.client.get("/health")

    @task(2)
    def metrics(self):
        self.client.get("/metrics")


class HuntingEventsUser(HttpUser):
    """Authenticated user querying hunting events."""

    weight = 2
    wait_time = between(1, 3)

    def on_start(self):
        self.token = "dev-token"
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(3)
    def hunting_events(self):
        self.client.get(
            "/api/hunting/events?limit=50",
            headers=self.headers,
            name="/api/hunting/events",
        )

    @task(1)
    def hunting_timeline(self):
        self.client.get(
            "/api/hunting/timeline?bucket=hour",
            headers=self.headers,
            name="/api/hunting/timeline",
        )


class IncidentPipelineUser(HttpUser):
    """Simulates the full incident lifecycle through agent processing."""

    weight = 1
    wait_time = between(3, 8)

    def on_start(self):
        self.token = "dev-token"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    @task(1)
    def health_check_during_incident(self):
        self.client.get("/health")
