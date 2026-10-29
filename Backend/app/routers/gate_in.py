from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app import site_settings
from app.auth import GATE_IN_ROLES, require_roles
from app.integrations import AdapterError, log_adapter_failure
from app.integrations.ocr import DOC_TYPE_PLATE, DOC_TYPES, get_ocr_adapter, normalize_plate
from app.integrations.po_lookup import MAX_SEARCH_RESULTS, get_po_lookup_adapter
from app.pass_creation import lookup_po
from app.photo_storage import InvalidPhotoError, read_upload_capped, validate_photo
from app.schemas import (
    MAX_CHALLAN_LINES,
    GateInConfigOut,
    OcrResultOut,
    PoLookupOut,
    PoOut,
    PoSearchHit,
)

# Gate-in OCR, PO lookup and config endpoints (spec 8.1).
router = APIRouter(prefix="/api/gate-in", tags=["gate-in"], dependencies=[Depends(require_roles(*GATE_IN_ROLES))])

MIN_SUPPLIER_SEARCH_LENGTH = 3
MAX_PO_NUMBER_LENGTH = 50
OCR_OFF_DETAIL = "OCR service is not configured"
OCR_FAILED_DETAIL = "OCR service failed. Enter the details manually."
UNKNOWN_DOC_TYPE_DETAIL = "doc_type must be plate, po or challan"
SUPPLIER_TOO_SHORT_DETAIL = "Enter at least 3 characters of the supplier name"


@router.get("/config", response_model=GateInConfigOut)
def get_config():
    return GateInConfigOut(
        ocr_enabled=get_ocr_adapter().enabled,
        po_lookup_enabled=get_po_lookup_adapter().enabled,
        ocr_confidence_threshold=site_settings.OCR_CONFIDENCE_THRESHOLD,
        max_challan_lines=MAX_CHALLAN_LINES,
    )


def _to_ocr_out(doc_type: str, data: dict) -> OcrResultOut:
    if doc_type == DOC_TYPE_PLATE:
        data = {**data, "plate": normalize_plate(data.get("plate"))}
    return OcrResultOut(doc_type=doc_type, **data)


@router.post("/ocr", response_model=OcrResultOut)
async def read_document(image: UploadFile = File(...), doc_type: str = Form(...)):
    """Stateless: the image is not stored here; the browser uploads it with its kind once the pass exists."""
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail=UNKNOWN_DOC_TYPE_DETAIL)
    adapter = get_ocr_adapter()
    if not adapter.enabled:
        raise HTTPException(status_code=503, detail=OCR_OFF_DETAIL)
    try:
        contents = await read_upload_capped(image)
        validate_photo(image.content_type, contents)
    except InvalidPhotoError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    try:
        data = adapter.read(contents, image.content_type, doc_type)
        return _to_ocr_out(doc_type, data)
    except (AdapterError, ValueError) as exc:
        log_adapter_failure("ocr", exc)
        raise HTTPException(status_code=502, detail=OCR_FAILED_DETAIL)


@router.get("/po/{po_number}", response_model=PoLookupOut)
def get_po(po_number: str):
    cleaned = po_number.strip()[:MAX_PO_NUMBER_LENGTH]
    status, po = lookup_po(cleaned)
    return PoLookupOut(status=status, po=PoOut(**po) if po else None)


@router.get("/po-search", response_model=List[PoSearchHit])
def search_po(supplier: str = Query(..., max_length=100)):
    # Checked after trimming so padded input like "  ul  " cannot slip past the minimum.
    search_text = supplier.strip()
    if len(search_text) < MIN_SUPPLIER_SEARCH_LENGTH:
        raise HTTPException(status_code=422, detail=SUPPLIER_TOO_SHORT_DETAIL)
    adapter = get_po_lookup_adapter()
    try:
        hits = adapter.search_by_supplier(search_text)
    except AdapterError as exc:
        # A failed search is just an empty list: the guard can still type the PO by hand.
        log_adapter_failure("po_lookup", exc)
        return []
    return [
        PoSearchHit(po_number=po["po_number"], supplier_name=po.get("supplier_name"), open_lines=len(po.get("lines", [])))
        for po in hits[:MAX_SEARCH_RESULTS]
    ]
