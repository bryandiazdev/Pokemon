"""Application settings.

Settings are read from environment variables via pydantic-settings. All values
have safe, documented defaults so the service runs out of the box in dev/demo
mode without any configuration.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # If set (env VISION_SERVICE_API_KEY), all API routes require a matching
    # "x-api-key" header. If unset, the service allows anonymous access, which
    # is convenient for local dev / demo but should NOT be used in production.
    api_key: str | None = Field(default=None, validation_alias="VISION_SERVICE_API_KEY")

    # Upload guards. Reject anything larger than this many bytes before decoding
    # to bound memory usage and mitigate abuse.
    max_upload_bytes: int = 15 * 1024 * 1024  # 15 MB

    # Decompression-bomb guard: refuse images whose decoded pixel count exceeds
    # this. A malicious tiny file can decode to billions of pixels.
    max_pixels: int = 40_000_000  # 40 megapixels

    # Version strings surfaced on /version and inside grade responses so clients
    # can reason about which analysis produced a result.
    model_version: str = "cv-heuristic-0.1.0"
    rules_version: str = "psa-2024.1"


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return a cached Settings instance (simple process-wide singleton)."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
