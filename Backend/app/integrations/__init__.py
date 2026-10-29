"""Adapters for external systems, each chosen from environment settings at startup.

Every adapter has `none` / `mock` / `http` implementations. URLs, keys and tenants come
only from the environment; an `http` provider without its URL fails at startup.
"""

import logging
import os
from typing import Iterable

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PROVIDER_NONE = "none"
PROVIDER_MOCK = "mock"
PROVIDER_HTTP = "http"


class AdapterError(Exception):
    """The external system failed or answered with something unusable."""


class AdapterConfigError(RuntimeError):
    """The environment selects a provider that cannot work as configured."""


def read_provider(env_name: str, default: str, allowed: Iterable[str]) -> str:
    value = os.getenv(env_name, default).strip().lower() or default
    allowed_values = tuple(allowed)
    if value not in allowed_values:
        raise AdapterConfigError(f"{env_name} must be one of {', '.join(allowed_values)} (got '{value}')")
    return value


def require_env(env_name: str, provider_env: str) -> str:
    value = os.getenv(env_name, "").strip()
    if not value:
        raise AdapterConfigError(f"{env_name} must be set when {provider_env}={PROVIDER_HTTP}")
    return value


def read_float(env_name: str, default: float) -> float:
    raw = os.getenv(env_name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        raise AdapterConfigError(f"{env_name} must be a number (got '{raw}')")


def log_adapter_failure(adapter: str, exc: Exception) -> None:
    # Only the error type and HTTP status: never the image, document text, key or URL query.
    status = getattr(getattr(exc, "response", None), "status_code", None)
    logger.warning("%s adapter failed: %s%s", adapter, type(exc).__name__, f" (HTTP {status})" if status else "")
