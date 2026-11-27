"""OCR adapter: number plate (ANPR) and PO / challan documents."""

import copy
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
from app.integrations import mock_data, ocr_local

PROVIDER_ENV = "OCR_PROVIDER"
PROVIDER_LOCAL = "local"
DEFAULT_TIMEOUT_SECONDS = 15.0
DOC_TYPE_PLATE = "plate"
DOC_TYPE_PO = "po"
DOC_TYPE_CHALLAN = "challan"
DOC_TYPES = (DOC_TYPE_PLATE, DOC_TYPE_PO, DOC_TYPE_CHALLAN)
ANPR_PATH = "/ocr/anpr"
DOCUMENT_PATH = "/ocr/document"


def normalize_plate(value: Optional[str]) -> Optional[str]:
    """Plates are stored uppercase without spaces; the screens add spacing for display."""
    if value is None:
        return None
    return "".join(value.split()).upper()


class NoOcr:
    enabled = False

    def read(self, image: bytes, content_type: str, doc_type: str) -> dict:
        raise AdapterError("OCR is not configured")


class MockOcr:
    enabled = True

    def read(self, image: bytes, content_type: str, doc_type: str) -> dict:
        if doc_type == DOC_TYPE_PLATE:
            return {"plate": mock_data.MOCK_PLATE, "confidence": mock_data.MOCK_PLATE_CONFIDENCE}
        if doc_type == DOC_TYPE_PO:
            return copy.deepcopy(mock_data.MOCK_PO_OCR)
        return copy.deepcopy(mock_data.MOCK_CHALLAN_OCR)


def _map_challan_lines(raw_lines) -> list:
    return [
        {
            "material": str(line.get("material", "")),
            "quantity": line.get("qty", line.get("quantity")),
            "uom": line.get("uom"),
            "confidence": line.get("confidence"),
        }
        for line in (raw_lines or [])
        if line.get("material")
    ]


def _map_document(doc_type: str, body: dict) -> dict:
    # The service uses the field names from the integration contract (po_no, challan_no, qty).
    if doc_type == DOC_TYPE_PO:
        return {
            "po_number": body.get("po_no"),
            "supplier_name": body.get("supplier_name"),
            "confidence": body.get("confidence"),
            "field_confidence": body.get("field_confidence") or {},
        }
    return {
        "challan_number": body.get("challan_no"),
        "confidence": body.get("confidence"),
        "lines": _map_challan_lines(body.get("lines")),
    }


class HttpOcr:
    enabled = True

    def __init__(self, base_url: str, api_key: str, timeout: float):
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout

    def _post(self, path: str, image: bytes, content_type: str, data: Optional[dict] = None) -> dict:
        try:
            response = httpx.post(
                f"{self._base_url}{path}",
                headers=self._headers,
                files={"image": ("capture", image, content_type)},
                data=data,
                timeout=self._timeout,
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AdapterError("OCR request failed") from exc

    def read(self, image: bytes, content_type: str, doc_type: str) -> dict:
        if doc_type == DOC_TYPE_PLATE:
            body = self._post(ANPR_PATH, image, content_type)
            return {"plate": body.get("plate"), "confidence": body.get("confidence")}
        body = self._post(DOCUMENT_PATH, image, content_type, data={"doc_type": doc_type})
        return _map_document(doc_type, body)


def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _map_po_fields(result: dict) -> dict:
    all_fields = result["extracted_data"].get("all_fields", {})
    confidence = result["confidence_score"]
    po_number = all_fields.get("po_number") or all_fields.get("invoice_number")
    supplier_name = all_fields.get("vendor_name") or all_fields.get("probable_vendor_name")
    field_confidence = {}
    if po_number:
        field_confidence["po_number"] = confidence
    if supplier_name:
        field_confidence["supplier_name"] = confidence
    return {
        "po_number": po_number,
        "supplier_name": supplier_name,
        "confidence": confidence,
        "field_confidence": field_confidence,
    }


def _map_challan_fields(result: dict) -> dict:
    from app.schemas import MAX_CHALLAN_LINES

    all_fields = result["extracted_data"].get("all_fields", {})
    confidence = result["confidence_score"]
    challan_number = all_fields.get("dispatch_doc_number") or all_fields.get("delivery_note")
    lines = [
        {
            "material": str(item.get("description") or item.get("hsn_sac") or "").strip(),
            "quantity": _to_float(item.get("qty")),
            "uom": item.get("unit") or None,
            "confidence": confidence,
        }
        for item in result["extracted_data"].get("line_items", [])
        if (item.get("description") or item.get("hsn_sac"))
    ][:MAX_CHALLAN_LINES]
    field_confidence = {}
    if challan_number:
        field_confidence["challan_number"] = confidence
    return {
        "challan_number": challan_number,
        "confidence": confidence,
        "lines": lines,
        "field_confidence": field_confidence,
    }


class LocalOcr:
    """Runs OCR in-process (Gemini Vision, falling back to Tesseract + regex). No ANPR support."""

    enabled = True

    def read(self, image: bytes, content_type: str, doc_type: str) -> dict:
        if doc_type == DOC_TYPE_PLATE:
            raise AdapterError("Number-plate recognition is not supported by the local OCR engine")
        try:
            result = ocr_local.scan_image(image, engine="auto")
        except Exception as exc:
            raise AdapterError("Local OCR engine failed") from exc
        if doc_type == DOC_TYPE_PO:
            return _map_po_fields(result)
        return _map_challan_fields(result)


@lru_cache(maxsize=1)
def get_ocr_adapter():
    provider = read_provider(
        PROVIDER_ENV, PROVIDER_NONE, (PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_HTTP, PROVIDER_LOCAL)
    )
    if provider == PROVIDER_MOCK:
        return MockOcr()
    if provider == PROVIDER_LOCAL:
        return LocalOcr()
    if provider == PROVIDER_HTTP:
        return HttpOcr(
            require_env("OCR_BASE_URL", PROVIDER_ENV),
            require_env("OCR_API_KEY", PROVIDER_ENV),
            read_float("OCR_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS),
        )
    return NoOcr()
