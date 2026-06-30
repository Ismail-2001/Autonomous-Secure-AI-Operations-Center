"""Input validation and sanitization for agent inputs.

Protects against injection attacks and malformed data.
"""

import re
from typing import Optional, Tuple


class InputValidator:
    """Validates and sanitizes agent inputs."""

    # Patterns that indicate potential injection
    INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
        re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.IGNORECASE),
        re.compile(r"system\s*:\s*", re.IGNORECASE),
        re.compile(r"<\|im_start\|>", re.IGNORECASE),
        re.compile(r"\[INST\]", re.IGNORECASE),
        re.compile(r"<\|system\|>", re.IGNORECASE),
    ]

    # SQL injection patterns
    SQL_PATTERNS = [
        re.compile(r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)", re.IGNORECASE),
        re.compile(r"(--|;|'|\"|\bOR\b\s+\b1\s*=\s*1\b)", re.IGNORECASE),
    ]

    # Path traversal patterns
    PATH_TRAVERSAL_PATTERNS = [
        re.compile(r"\.\./"),
        re.compile(r"\.\.\\"),
        re.compile(r"/etc/passwd"),
        re.compile(r"/etc/shadow"),
    ]

    @classmethod
    def validate_text(
        cls,
        text: str,
        max_length: int = 10000,
        allow_html: bool = False,
    ) -> Tuple[bool, Optional[str]]:
        """Validate text input for safety.

        Returns:
            (is_valid, error_message)
        """
        if not text:
            return True, None

        if len(text) > max_length:
            return False, f"Input exceeds maximum length of {max_length}"

        # Check for injection patterns
        for pattern in cls.INJECTION_PATTERNS:
            if pattern.search(text):
                return False, "Input contains potentially malicious content"

        # Check for SQL injection
        for pattern in cls.SQL_PATTERNS:
            if pattern.search(text):
                return False, "Input contains SQL-like syntax"

        # Check for path traversal
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if pattern.search(text):
                return False, "Input contains path traversal patterns"

        # HTML check
        if not allow_html and "<" in text and ">" in text:
            if re.search(r"<[a-zA-Z]", text):
                return False, "Input contains HTML tags"

        return True, None

    @classmethod
    def sanitize(cls, text: str) -> str:
        """Sanitize text by removing dangerous patterns."""
        if not text:
            return text

        # Remove null bytes
        text = text.replace("\x00", "")

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text).strip()

        # Remove control characters (except newlines and tabs)
        text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        return text

    @classmethod
    def validate_identifier(cls, identifier: str) -> bool:
        """Validate that an identifier is safe (alphanumeric + underscore)."""
        return bool(re.match(r"^[a-zA-Z0-9_]{1,128}$", identifier))
