"""Purchase-order lookup in the ERP (read side). Used to cross-check, never to block."""

import copy
import os
from functools import lru_cache
from typing import List, Optional

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

PROVIDER_ENV = "PO_LOOKUP_PROVIDER"
DEFAULT_TIMEOUT_SECONDS = 10.0
MAX_SEARCH_RESULTS = 20
HTTP_NOT_FOUND = 404


class NoPoLookup:
    enabled = False

    def get_po(self, po_number: str) -> Optional[dict]:
        raise AdapterError("PO lookup is not configured")

    def search_by_supplier(self, text: str) -> List[dict]:
        return []


class MockPoLookup:
    enabled = True

    def get_po(self, po_number: str) -> Optional[dict]:
        wanted = po_number.strip().upper()
        for po in mock_data.MOCK_PURCHASE_ORDERS:
            if po["po_number"].upper() == wanted:
                return copy.deepcopy(po)
        return None

    def search_by_supplier(self, text: str) -> List[dict]:
        needle = text.strip().lower()
        hits = [po for po in mock_data.MOCK_PURCHASE_ORDERS if needle in po["supplier_name"].lower()]
        return copy.deepcopy(hits[:MAX_SEARCH_RESULTS])


def _map_po(body: dict) -> dict:
    return {
        "po_number": body.get("po_no") or body.get("po_number"),
        "supplier_name": body.get("supplier_name"),
        "lines": [
            {"material": line.get("material"), "uom": line.get("uom"), "open_qty": line.get("open_qty")}
            for line in (body.get("lines") or [])
            if line.get("material")
        ],
    }


class HttpPoLookup:
    enabled = True

    def __init__(self, base_url: str, api_key: str, tenant_id: str, timeout: float):
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._tenant = tenant_id
        self._timeout = timeout

    def _get(self, path: str, params: dict) -> httpx.Response:
        try:
            return httpx.get(
                f"{self._base_url}{path}",
                headers=self._headers,
                params={**params, "tenant": self._tenant},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise AdapterError("PO lookup request failed") from exc

    def get_po(self, po_number: str) -> Optional[dict]:
        response = self._get("/purchase-orders", {"po_no": po_number})
        if response.status_code == HTTP_NOT_FOUND:
            return None
        try:
            response.raise_for_status()
            return _map_po(response.json())
        except (httpx.HTTPError, ValueError) as exc:
            raise AdapterError("PO lookup returned an unusable answer") from exc

    def search_by_supplier(self, text: str) -> List[dict]:
        response = self._get("/purchase-orders", {"supplier": text, "status": "open"})
        try:
            response.raise_for_status()
            return [_map_po(po) for po in response.json()][:MAX_SEARCH_RESULTS]
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
            raise AdapterError("PO search returned an unusable answer") from exc


@lru_cache(maxsize=1)
def get_po_lookup_adapter():
    provider = read_provider(PROVIDER_ENV, PROVIDER_NONE, (PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_HTTP))
    if provider == PROVIDER_MOCK:
        return MockPoLookup()
    if provider == PROVIDER_HTTP:
        return HttpPoLookup(
            require_env("FARVISION_READ_URL", PROVIDER_ENV),
            require_env("FARVISION_READ_KEY", PROVIDER_ENV),
            require_env("ERP_TENANT_ID", PROVIDER_ENV),
            read_float("PO_LOOKUP_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS),
        )
    return NoPoLookup()
