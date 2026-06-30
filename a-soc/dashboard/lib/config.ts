"""Dashboard configuration and feature flags.

Centralizes all dashboard-specific configuration in one place.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class DashboardConfig:
    """Immutable dashboard configuration.

    All values can be overridden via environment variables.
    """

    # WebSocket
    ws_url: str = "ws://localhost:9002"
    ws_token: str = "dev-token"
    ws_max_reconnect: int = 10
    ws_base_delay_ms: int = 1000
    ws_max_delay_ms: int = 30000

    # Display
    max_events: int = 100
    max_background_events: int = 50
    refresh_interval_ms: int = 5000
    clock_interval_ms: int = 1000

    # Feature flags
    enable_threat_hunting: bool = True
    enable_blast_radius: bool = True
    enable_terminal_feed: bool = True
    enable_agent_grid: bool = True
    enable_approval_workflow: bool = True

    # Agent display colors
    agent_colors: dict = field(default_factory=lambda: {
        "TelemetryAgent": "#3b82f6",   # blue
        "DetectionAgent": "#f59e0b",   # amber
        "SupervisorAgent": "#8b5cf6",  # violet
        "ForensicsAgent": "#10b981",   # emerald
        "ResponseAgent": "#ef4444",    # red
        "ComplianceAgent": "#06b6d4",  # cyan
        "NotificationAgent": "#f97316", # orange
    })

    # Severity colors
    severity_colors: dict = field(default_factory=lambda: {
        "critical": "#dc2626",
        "high": "#ea580c",
        "medium": "#d97706",
        "low": "#2563eb",
        "info": "#6b7280",
    })


def get_dashboard_config() -> DashboardConfig:
    """Create DashboardConfig from environment variables."""
    import os

    return DashboardConfig(
        ws_url=os.getenv("NEXT_PUBLIC_WS_URL", "ws://localhost:9002"),
        ws_token=os.getenv("NEXT_PUBLIC_WS_TOKEN", "dev-token"),
        ws_max_reconnect=int(os.getenv("WS_MAX_RECONNECT", "10")),
        enable_threat_hunting=os.getenv("ENABLE_THREAT_HUNTING", "true").lower() == "true",
        enable_blast_radius=os.getenv("ENABLE_BLAST_RADIUS", "true").lower() == "true",
        enable_terminal_feed=os.getenv("ENABLE_TERMINAL_FEED", "true").lower() == "true",
        enable_agent_grid=os.getenv("ENABLE_AGENT_GRID", "true").lower() == "true",
        enable_approval_workflow=os.getenv("ENABLE_APPROVAL_WORKFLOW", "true").lower() == "true",
    )
