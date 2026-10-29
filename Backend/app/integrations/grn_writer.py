"""ERP GRN writer adapter (mock or http), chosen from GRN_WRITE_PROVIDER at startup.

`post_grn(payload, idempotency_key)` returns `{"grn_number": ...}` or raises `GrnWriteError`.
Error messages are safe to store and show: they never contain the URL, key or document content.
"""

import logging
import os
from functools import lru_cache
from typing import Any, Dict, Protocol

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PROVIDER_MOCK = "mock"
PROVIDER_HTTP = "http"
DEFAULT_PROVIDER = PROVIDER_MOCK
DEFAULT_ERP_INSTANCE = "VJ"
DEFAULT_ERP_TENANT_ID = "75"
DEFAULT_TIMEOUT_SECONDS = 20.0
MOCK_GRN_PREFIX = "MOCK-GRN-"
MAX_GRN_NUMBER_LENGTH = 50
TRUE_VALUES = frozenset({"1", "true", "yes", "on"})


class GrnWriteError(Exception):
    """The ERP did not accept the GRN; the message is safe to store and display."""


class GrnWriter(Protocol):
    def post_grn(self, payload: Dict[str, Any], idempotency_key: str) -> Dict[str, str]: ...


class MockGrnWriter:
    def __init__(self, always_fail: bool):
        self.always_fail = always_fail

    def post_grn(self, payload: Dict[str, Any], idempotency_key: str) -> Dict[str, str]:
        if self.always_fail:
            raise GrnWriteError("Mock ERP failure (GRN_MOCK_FAIL is on)")
        return {"grn_number": f"{MOCK_GRN_PREFIX}{payload['grn_id']}"}


class HttpGrnWriter:
    def __init__(self, url: str, api_key: str, erp_instance: str, tenant_id: str, timeout_seconds: float):
        self.url = url
        self.api_key = api_key
        self.erp_instance = erp_instance
        self.tenant_id = tenant_id
        self.timeout_seconds = timeout_seconds

    def post_grn(self, payload: Dict[str, Any], idempotency_key: str) -> Dict[str, str]:
        # Imported here so the mock provider works on machines without httpx installed.
        import httpx

        body = {**payload, "erp_instance": self.erp_instance, "tenant_id": self.tenant_id}
        headers = {"X-Api-Key": self.api_key, "Idempotency-Key": idempotency_key}
        try:
            response = httpx.post(self.url, json=body, headers=headers, timeout=self.timeout_seconds)
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException:
            logger.warning("GRN write timed out")
            raise GrnWriteError("ERP did not respond in time")
        except httpx.HTTPStatusError as exc:
            logger.warning("GRN write rejected with HTTP %s", exc.response.status_code)
            raise GrnWriteError(f"ERP returned HTTP {exc.response.status_code}")
        except httpx.RequestError as exc:
            logger.warning("GRN write could not reach the ERP (%s)", type(exc).__name__)
            raise GrnWriteError("Could not reach the ERP")
        except ValueError:
            logger.warning("GRN write returned a response that is not JSON")
            raise GrnWriteError("ERP returned an unreadable response")
        return {"grn_number": _extract_grn_number(data)}


def _extract_grn_number(data: Any) -> str:
    grn_number = data.get("grn_number") if isinstance(data, dict) else None
    if not grn_number:
        logger.warning("GRN write response had no GRN number")
        raise GrnWriteError("ERP response had no GRN number")
    return str(grn_number)[:MAX_GRN_NUMBER_LENGTH]


def _read_timeout_seconds() -> float:
    raw = os.getenv("GRN_WRITE_TIMEOUT_SECONDS", "").strip()
    if not raw:
        return DEFAULT_TIMEOUT_SECONDS
    try:
        value = float(raw)
    except ValueError:
        raise RuntimeError("GRN_WRITE_TIMEOUT_SECONDS must be a number of seconds")
    if value <= 0:
        raise RuntimeError("GRN_WRITE_TIMEOUT_SECONDS must be greater than 0")
    return value


def _build_http_writer() -> HttpGrnWriter:
    url = os.getenv("FARVISION_WRITE_URL", "").strip()
    api_key = os.getenv("FARVISION_WRITE_KEY", "").strip()
    if not url or not api_key:
        raise RuntimeError("GRN_WRITE_PROVIDER=http needs FARVISION_WRITE_URL and FARVISION_WRITE_KEY to be set")
    return HttpGrnWriter(
        url=url,
        api_key=api_key,
        erp_instance=os.getenv("ERP_INSTANCE", "").strip() or DEFAULT_ERP_INSTANCE,
        tenant_id=os.getenv("ERP_TENANT_ID", "").strip() or DEFAULT_ERP_TENANT_ID,
        timeout_seconds=_read_timeout_seconds(),
    )


@lru_cache(maxsize=1)
def get_grn_writer() -> GrnWriter:
    """Build the writer once; a misconfigured http provider fails here with a clear message."""
    provider = os.getenv("GRN_WRITE_PROVIDER", "").strip().lower() or DEFAULT_PROVIDER
    if provider == PROVIDER_MOCK:
        always_fail = os.getenv("GRN_MOCK_FAIL", "").strip().lower() in TRUE_VALUES
        return MockGrnWriter(always_fail=always_fail)
    if provider == PROVIDER_HTTP:
        return _build_http_writer()
    raise RuntimeError(f"GRN_WRITE_PROVIDER must be '{PROVIDER_MOCK}' or '{PROVIDER_HTTP}'")
