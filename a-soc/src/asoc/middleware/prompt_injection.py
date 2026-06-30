"""Prompt injection detection middleware.

Scans all user-controlled strings before they reach LLM providers.
Uses pattern matching, not an LLM (to avoid circular dependency on the thing we're protecting).

Threat model:
- Direct injection: user input contains instructions that override system prompts
- Indirect injection: user input contains embedded instructions in fetched content
- Jailbreak attempts: role-play, persona switching, "ignore previous instructions"
- Data exfiltration: attempts to extract system prompt or tool definitions
"""
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from src.asoc.core.logging import get_logger

logger = get_logger("asoc.security.prompt_injection")


class ThreatLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DetectionResult:
    threat_level: ThreatLevel
    matched_patterns: list[str] = field(default_factory=list)
    sanitized_text: Optional[str] = None
    blocked: bool = False


# ── Detection Patterns ────────────────────────────────────────────────────
# Each pattern is (compiled_regex, threat_level, description)

_INJECTION_PATTERNS: list[tuple[re.Pattern, ThreatLevel, str]] = [
    # Direct prompt override attempts
    (re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE), ThreatLevel.CRITICAL, "direct_override"),
    (re.compile(r"disregard\s+(all\s+)?prior\s+(instructions|prompts|rules)", re.IGNORECASE), ThreatLevel.CRITICAL, "direct_override"),
    (re.compile(r"forget\s+(everything|all|your)\s+(you|instructions)", re.IGNORECASE), ThreatLevel.CRITICAL, "direct_override"),
    (re.compile(r"override\s+(your|the|system)\s+(instructions|prompt|rules)", re.IGNORECASE), ThreatLevel.CRITICAL, "direct_override"),

    # System prompt extraction
    (re.compile(r"(show|reveal|print|output|repeat|display)\s+(me\s+)?(your|the)\s+(system\s+)?prompt", re.IGNORECASE), ThreatLevel.HIGH, "prompt_extraction"),
    (re.compile(r"what\s+(are|is)\s+your\s+(system\s+)?(instructions|prompt|rules)", re.IGNORECASE), ThreatLevel.HIGH, "prompt_extraction"),
    (re.compile(r"dump\s+(your|the)\s+(system|initial)\s+(prompt|message)", re.IGNORECASE), ThreatLevel.HIGH, "prompt_extraction"),

    # Role/persona switching
    (re.compile(r"you\s+are\s+now\s+(a|an|the)\s+", re.IGNORECASE), ThreatLevel.MEDIUM, "role_switch"),
    (re.compile(r"act\s+as\s+(if\s+)?(you\s+are|a|an|the)\s+", re.IGNORECASE), ThreatLevel.MEDIUM, "role_switch"),
    (re.compile(r"pretend\s+(you\s+are|to\s+be|you['\"]?re)\s+", re.IGNORECASE), ThreatLevel.MEDIUM, "role_switch"),
    (re.compile(r"switch\s+to\s+(a\s+)?(different|new|other)\s+(persona|role|mode)", re.IGNORECASE), ThreatLevel.MEDIUM, "role_switch"),
    (re.compile(r"enter\s+(developer|debug|admin|god|sudo)\s+mode", re.IGNORECASE), ThreatLevel.HIGH, "mode_switch"),

    # Jailbreak patterns
    (re.compile(r"DAN\s+mode", re.IGNORECASE), ThreatLevel.HIGH, "jailbreak"),
    (re.compile(r"do\s+anything\s+now", re.IGNORECASE), ThreatLevel.HIGH, "jailbreak"),
    (re.compile(r"jailbreak", re.IGNORECASE), ThreatLevel.MEDIUM, "jailbreak"),
    (re.compile(r"(unrestricted|uncensored|unfiltered)\s+mode", re.IGNORECASE), ThreatLevel.MEDIUM, "jailbreak"),

    # Data exfiltration
    (re.compile(r"(extract|exfiltrate|leak|send)\s+(the\s+)?(system\s+)?(prompt|config|secret|key|token)", re.IGNORECASE), ThreatLevel.CRITICAL, "exfiltration"),
    (re.compile(r"(curl|wget|fetch|http)\s+(to\s+)?https?://", re.IGNORECASE), ThreatLevel.HIGH, "exfiltration_url"),
    (re.compile(r"<script[^>]*>", re.IGNORECASE), ThreatLevel.HIGH, "xss_attempt"),

    # Tool/API manipulation
    (re.compile(r"(call|invoke|execute|run)\s+(the\s+)?(tool|function|api)\s+", re.IGNORECASE), ThreatLevel.MEDIUM, "tool_manipulation"),
    (re.compile(r"(register|add|create)\s+(a\s+)?(new\s+)?tool", re.IGNORECASE), ThreatLevel.HIGH, "tool_manipulation"),

    # Encoding evasion (base64 encoded instructions)
    (re.compile(r"(base64|rot13|hex)\s*[:=]\s*[A-Za-z0-9+/]{20,}"), ThreatLevel.MEDIUM, "encoding_evasion"),
]

# Sanitization: strip control characters and zero-width chars
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u2028-\u202f\u2060-\u2069\ufeff]")


def _sanitize(text: str) -> str:
    """Remove control characters and zero-width Unicode that could hide injection."""
    return _CONTROL_CHARS.sub("", text)


def detect_injection(text: str, context: str = "") -> DetectionResult:
    """Scan text for prompt injection patterns.

    Args:
        text: The user-controlled string to scan.
        context: Optional context (e.g., agent name) for logging.

    Returns:
        DetectionResult with threat level, matched patterns, and sanitized text.
    """
    if not text or not text.strip():
        return DetectionResult(threat_level=ThreatLevel.NONE)

    sanitized = _sanitize(text)
    matches: list[str] = []
    max_level = ThreatLevel.NONE
    level_order = [ThreatLevel.NONE, ThreatLevel.LOW, ThreatLevel.MEDIUM, ThreatLevel.HIGH, ThreatLevel.CRITICAL]

    for pattern, level, desc in _INJECTION_PATTERNS:
        if pattern.search(sanitized):
            matches.append(desc)
            if level_order.index(level) > level_order.index(max_level):
                max_level = level

    blocked = max_level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL)

    if max_level != ThreatLevel.NONE:
        logger.warning(
            "prompt_injection_detected",
            threat_level=max_level.value,
            patterns=matches,
            context=context,
            text_length=len(text),
            blocked=blocked,
        )

    return DetectionResult(
        threat_level=max_level,
        matched_patterns=matches,
        sanitized_text=sanitized,
        blocked=blocked,
    )


def scan_for_injection(*texts: str, context: str = "") -> DetectionResult:
    """Scan multiple text fields and return the highest threat level found."""
    worst = DetectionResult(threat_level=ThreatLevel.NONE)

    level_order = [ThreatLevel.NONE, ThreatLevel.LOW, ThreatLevel.MEDIUM, ThreatLevel.HIGH, ThreatLevel.CRITICAL]

    for text in texts:
        result = detect_injection(text, context)
        if level_order.index(result.threat_level) > level_order.index(worst.threat_level):
            worst = result
        worst.matched_patterns.extend(result.matched_patterns)

    return worst


# ── Middleware Integration ─────────────────────────────────────────────────

def validate_agent_input(
    agent_name: str,
    **fields: str,
) -> None:
    """Validate all input fields for an agent. Raises ValueError if injection detected.

    Usage:
        validate_agent_input(
            "DetectionAgent",
            event_data=str(event_data),
            user_query=query,
        )
    """
    texts = [f"{k}={v}" for k, v in fields.items() if v]
    if not texts:
        return

    combined = " | ".join(texts)
    result = scan_for_injection(combined, context=agent_name)

    if result.blocked:
        raise ValueError(
            f"Prompt injection blocked in {agent_name}: "
            f"threat={result.threat_level.value}, patterns={result.matched_patterns}"
        )

    if result.threat_level == ThreatLevel.MEDIUM:
        logger.warning(
            "medium_threat_in_input",
            agent=agent_name,
            patterns=result.matched_patterns,
        )
