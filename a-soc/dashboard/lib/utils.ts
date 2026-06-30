"""Utility functions for the A-SOC dashboard."""

from datetime import datetime, timezone
from typing import Optional


def format_timestamp(iso_string: Optional[str]) -> str:
    """Format ISO timestamp to human-readable relative time."""
    if not iso_string:
        return "Never"

    try:
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff = now - dt

        seconds = int(diff.total_seconds())
        if seconds < 60:
            return f"{seconds}s ago"
        elif seconds < 3600:
            return f"{seconds // 60}m ago"
        elif seconds < 86400:
            return f"{seconds // 3600}h ago"
        else:
            return f"{seconds // 86400}d ago"
    except (ValueError, TypeError):
        return iso_string


def format_risk_score(score: float) -> str:
    """Format risk score with color hint."""
    if score >= 0.8:
        return f"CRITICAL ({score:.1%})"
    elif score >= 0.6:
        return f"HIGH ({score:.1%})"
    elif score >= 0.4:
        return f"MEDIUM ({score:.1%})"
    elif score >= 0.2:
        return f"LOW ({score:.1%})"
    else:
        return f"INFO ({score:.1%})"


def get_risk_color(score: float) -> str:
    """Get Tailwind color class for risk score."""
    if score >= 0.8:
        return "text-red-500"
    elif score >= 0.6:
        return "text-orange-500"
    elif score >= 0.4:
        return "text-yellow-500"
    elif score >= 0.2:
        return "text-blue-500"
    else:
        return "text-slate-400"


def truncate(text: str, max_length: int = 100) -> str:
    """Truncate text with ellipsis if too long."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."
