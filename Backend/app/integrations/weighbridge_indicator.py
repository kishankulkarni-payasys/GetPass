"""Weighbridge indicator adapter. The server reads weights itself; the browser never supplies them."""

import json
import random
import uuid
from functools import lru_cache
from typing import Optional

import httpx

from app.integrations import (
    PROVIDER_HTTP,
    PROVIDER_MOCK,
    PROVIDER_NONE,
    AdapterError,
    read_float,
    read_provider,
    require_env,
)
from app.integrations import mock_data

PROVIDER_ENV = "WEIGHBRIDGE_PROVIDER"
DEFAULT_TIMEOUT_SECONDS = 5.0
MAX_RAW_FRAME_LENGTH = 2000
MAX_FRAME_REF_LENGTH = 100


class NoIndicator:
    available = False

    def read(self) -> dict:
        raise AdapterError("Weighbridge indicator is not configured")


class MockIndicator:
    available = True

    def read(self) -> dict:
        weight_kg = float(random.randint(mock_data.MOCK_MIN_WEIGHT_KG, mock_data.MOCK_MAX_WEIGHT_KG))
        stable = random.randrange(mock_data.MOCK_UNSTABLE_ONE_IN) != 0
        frame_ref = f"MOCK-{uuid.uuid4().hex[:12]}"
        raw_frame = json.dumps({"weight_kg": weight_kg, "stable": stable, "frame": frame_ref})
        return {"weight_kg": weight_kg, "stable": stable, "frame_ref": frame_ref, "raw_frame": raw_frame}


def _clip(value: Optional[str], limit: int) -> Optional[str]:
    return value[:limit] if value else value


class HttpIndicator:
    available = True

    def __init__(self, url: str, api_key: str, timeout: float):
        self._url = url
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout

    def read(self) -> dict:
        try:
            response = httpx.get(self._url, headers=self._headers, timeout=self._timeout)
            response.raise_for_status()
            body = response.json()
            weight_kg = float(body["weight_kg"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise AdapterError("Weighbridge indicator request failed") from exc
        raw = body.get("raw_frame")
        return {
            "weight_kg": weight_kg,
            "stable": bool(body.get("stable")),
            "frame_ref": _clip(body.get("frame_ref"), MAX_FRAME_REF_LENGTH),
            # Keep what the indicator actually sent, so the record can be audited later.
            "raw_frame": _clip(raw if isinstance(raw, str) else response.text, MAX_RAW_FRAME_LENGTH),
        }


@lru_cache(maxsize=1)
def get_indicator_adapter():
    provider = read_provider(PROVIDER_ENV, PROVIDER_NONE, (PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_HTTP))
    if provider == PROVIDER_MOCK:
        return MockIndicator()
    if provider == PROVIDER_HTTP:
        return HttpIndicator(
            require_env("WEIGHBRIDGE_URL", PROVIDER_ENV),
            require_env("WEIGHBRIDGE_KEY", PROVIDER_ENV),
            read_float("WEIGHBRIDGE_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS),
        )
    return NoIndicator()
