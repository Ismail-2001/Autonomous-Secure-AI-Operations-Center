"""Rate limit response headers per RFC 6585.

Provides standard rate limit headers for API responses.
"""

from typing import Optional


def rate_limit_headers(
    limit: int,
    remaining: int,
    reset_seconds: int,
    retry_after: Optional[int] = None,
) -> dict:
    """Generate standard rate limit headers.

    Args:
        limit: Maximum requests per window
        remaining: Requests remaining in current window
        reset_seconds: Seconds until window resets
        retry_after: Seconds to wait before retrying (429 responses)

    Returns:
        Dictionary of HTTP headers
    """
    headers = {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(max(0, remaining)),
        "X-RateLimit-Reset": str(reset_seconds),
    }

    if retry_after is not None:
        headers["Retry-After"] = str(retry_after)

    return headers


def rate_limit_exceeded_headers(
    limit: int,
    reset_seconds: int,
    retry_after: int = 60,
) -> dict:
    """Generate headers for rate limit exceeded response."""
    return rate_limit_headers(
        limit=limit,
        remaining=0,
        reset_seconds=reset_seconds,
        retry_after=retry_after,
    )
