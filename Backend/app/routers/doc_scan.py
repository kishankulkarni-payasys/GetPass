"""Doc Scan: upload a PDF or photos of a document, extract fields, review and save them."""

import json
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import GATE_IN_ROLES, get_current_user, require_roles
from app.database import get_db
from app.doc_scan_extractor import parse_fields
from app.integrations import AdapterError, log_adapter_failure
from app.integrations.ocr import DOC_TYPE_SCAN, get_ocr_adapter
from app.models import DocScanResult, User
from app.pdf_conversion import extract_pdf_pages
from app.photo_storage import InvalidPhotoError, read_upload_capped, validate_photo
from app.schemas import DocScanOut, DocScanSaveIn, DocScanSavedOut

router = APIRouter(prefix="/api/doc-scan", tags=["doc-scan"], dependencies=[Depends(get_current_user)])
require_gate_in = require_roles(*GATE_IN_ROLES)

MAX_PHOTOS = 10
OCR_OFF_DETAIL = "OCR service is not configured"
OCR_FAILED_DETAIL = "OCR service failed. Enter the details manually."
NOT_A_PDF_DETAIL = "Only PDF files are allowed"
NO_PHOTOS_DETAIL = "Add at least one photo"
TOO_MANY_PHOTOS_DETAIL = f"Send at most {MAX_PHOTOS} photos at a time"


def _ocr_text(adapter, image: bytes, content_type: str) -> str:
    try:
        data = adapter.read(image, content_type, DOC_TYPE_SCAN)
    except (AdapterError, ValueError) as exc:
        log_adapter_failure("ocr", exc)
        raise HTTPException(status_code=502, detail=OCR_FAILED_DETAIL)
    return data.get("text", "")


@router.post("/pdf", response_model=DocScanOut)
async def scan_pdf(file: UploadFile = File(...), current_user: User = Depends(require_gate_in)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail=NOT_A_PDF_DETAIL)

    try:
        contents = await read_upload_capped(file)
        pages = extract_pdf_pages(contents)
    except InvalidPhotoError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    adapter = get_ocr_adapter()
    ocr_used = False
    texts = []
    for page in pages:
        if page["png"] is None:
            texts.append(page["text"])
            continue
        if not adapter.enabled:
            raise HTTPException(status_code=503, detail=OCR_OFF_DETAIL)
        texts.append(_ocr_text(adapter, page["png"], "image/png"))
        ocr_used = True

    full_text = "\n\n".join(texts)
    return DocScanOut(
        file_name=file.filename or "document.pdf",
        method="ocr" if ocr_used else "text",
        page_count=len(pages),
        fields=parse_fields(full_text),
        raw_text=full_text,
    )


@router.post("/photo", response_model=DocScanOut)
async def scan_photo(files: List[UploadFile] = File(...), current_user: User = Depends(require_gate_in)):
    if not files:
        raise HTTPException(status_code=422, detail=NO_PHOTOS_DETAIL)
    if len(files) > MAX_PHOTOS:
        raise HTTPException(status_code=422, detail=TOO_MANY_PHOTOS_DETAIL)

    adapter = get_ocr_adapter()
    if not adapter.enabled:
        raise HTTPException(status_code=503, detail=OCR_OFF_DETAIL)

    texts = []
    for photo in files:
        try:
            contents = await read_upload_capped(photo)
            validate_photo(photo.content_type, contents)
        except InvalidPhotoError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        texts.append(_ocr_text(adapter, contents, photo.content_type))

    full_text = "\n\n".join(texts)
    file_name = (files[0].filename or "photo") if len(files) == 1 else f"{len(files)} photos"
    return DocScanOut(
        file_name=file_name,
        method="photo",
        page_count=len(files),
        fields=parse_fields(full_text),
        raw_text=full_text,
    )


@router.post("/save", response_model=DocScanSavedOut)
def save_scan(body: DocScanSaveIn, db: Session = Depends(get_db), current_user: User = Depends(require_gate_in)):
    record = DocScanResult(
        file_name=body.file_name,
        scan_method=body.method,
        page_count=body.page_count,
        fields_json=json.dumps(body.fields, ensure_ascii=False),
        raw_text=body.raw_text,
        created_by_id=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return DocScanSavedOut(id=record.id)
