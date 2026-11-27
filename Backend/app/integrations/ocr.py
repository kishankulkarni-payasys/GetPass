"""OCR adapter: number plate (ANPR) and PO / challan documents."""

import copy
import io
import os
import re
import shutil
from functools import lru_cache
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image

from app.integrations import (
    AdapterConfigError,
    PROVIDER_HTTP,
    PROVIDER_MOCK,
    PROVIDER_NONE,
    AdapterError,
    read_float,
    read_provider,
    require_env,
)
from app.integrations import mock_data
from app.doc_scan_extractor import find_po_number_by_position, parse_fields

PROVIDER_ENV = "OCR_PROVIDER"
DEFAULT_TIMEOUT_SECONDS = 15.0
PROVIDER_TESSERACT = "tesseract"
DOC_TYPE_PLATE = "plate"
DOC_TYPE_PO = "po"
DOC_TYPE_CHALLAN = "challan"
DOC_TYPES = (DOC_TYPE_PLATE, DOC_TYPE_PO, DOC_TYPE_CHALLAN)
# Not part of DOC_TYPES: it's used only by the doc-scan endpoints, not the gate-in /ocr
# whitelist, since its response shape (raw text) doesn't fit OcrResultOut.
DOC_TYPE_SCAN = "scan"
ANPR_PATH = "/ocr/anpr"
DOCUMENT_PATH = "/ocr/document"
PLATE_PATTERN = re.compile(r"\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}\b", re.IGNORECASE)
CHALLAN_PATTERN = re.compile(
    r"(?:challan|chalan)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,30})",
    re.IGNORECASE,
)


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
        if doc_type == DOC_TYPE_SCAN:
            return {"text": mock_data.MOCK_SCAN_TEXT}
        return copy.deepcopy(mock_data.MOCK_CHALLAN_OCR)


class TesseractOcr:
    enabled = True

    def __init__(self):
        import pytesseract

        executable = os.getenv("TESSERACT_CMD", "").strip()
        if executable:
            if not Path(executable).is_file():
                raise AdapterConfigError("TESSERACT_CMD must point to an installed Tesseract executable")
        else:
            executable = shutil.which("tesseract") or ""
        if not executable:
            raise AdapterConfigError("Tesseract is not installed or available on PATH")

        pytesseract.pytesseract.tesseract_cmd = executable
        self._pytesseract = pytesseract
        self._language = os.getenv("TESSERACT_LANG", "eng").strip() or "eng"

    def read(self, image: bytes, content_type: str, doc_type: str) -> dict:
        pil_image = Image.open(io.BytesIO(image))
        try:
            text = self._pytesseract.image_to_string(pil_image, lang=self._language)
        except (OSError, self._pytesseract.TesseractError) as exc:
            raise AdapterError("Local OCR request failed") from exc

        if doc_type == DOC_TYPE_SCAN:
            return {"text": text}
        if doc_type == DOC_TYPE_PO:
            po_number = parse_fields(text)["po_number"]
            if po_number is None:
                po_number = self._po_number_by_position(pil_image)
            return {
                "po_number": po_number,
                "supplier_name": None,
                "confidence": None,
                "field_confidence": {},
            }
        if doc_type == DOC_TYPE_PLATE:
            match = PLATE_PATTERN.search(text)
            return {"plate": match.group(0) if match else None, "confidence": None}
        if doc_type == DOC_TYPE_CHALLAN:
            match = CHALLAN_PATTERN.search(text)
            return {
                "challan_number": match.group(1) if match else None,
                "confidence": None,
                "lines": [],
            }
        raise AdapterError("Unsupported OCR document type")

    def _po_number_by_position(self, pil_image: Image.Image) -> Optional[str]:
        """Fallback for multi-column documents where plain-text regex can't find
        the PO number because Tesseract's reading order interleaves other
        columns between the "PO NO" label and its value on the same row."""
        try:
            data = self._pytesseract.image_to_data(
                pil_image, lang=self._language, output_type=self._pytesseract.Output.DICT
            )
        except (OSError, self._pytesseract.TesseractError):
            return None
        return find_po_number_by_position(data)


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
    if doc_type == DOC_TYPE_SCAN:
        return {"text": body.get("text", "")}
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


@lru_cache(maxsize=1)
def get_ocr_adapter():
    provider = read_provider(
        PROVIDER_ENV, PROVIDER_NONE, (PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_HTTP, PROVIDER_TESSERACT)
    )
    if provider == PROVIDER_MOCK:
        return MockOcr()
    if provider == PROVIDER_TESSERACT:
        return TesseractOcr()
    if provider == PROVIDER_HTTP:
        return HttpOcr(
            require_env("OCR_BASE_URL", PROVIDER_ENV),
            require_env("OCR_API_KEY", PROVIDER_ENV),
            read_float("OCR_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS),
        )
    return NoOcr()
