"""API-key authentication dependency.

If `settings.api_key` is configured, every protected route requires a matching
`x-api-key` header. If it is not configured, the service runs in open dev/demo
mode and allows all requests.
"""

from __future__ import annotations

from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """FastAPI dependency enforcing the optional API key.

    Raises 401 if a key is configured and the header is missing or wrong.
    """
    settings = get_settings()
    if settings.api_key is None:
        # Open mode: no key configured.
        return
    if x_api_key is None or x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
