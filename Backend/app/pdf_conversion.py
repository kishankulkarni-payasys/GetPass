import math
from typing import List

import pymupdf

from app.photo_storage import InvalidPhotoError, MAX_PHOTO_SIZE_BYTES

PDF_SIGNATURE = b"%PDF-"
MAX_RENDERED_PIXELS = 16_000_000
MAX_RENDER_SCALE = 2.0
MIN_RENDER_SCALE = 0.5
# Below this many characters of digital text, a page is treated as scanned and rendered for OCR.
MIN_TEXT_PER_PAGE = 30


def _open_pdf(contents: bytes) -> pymupdf.Document:
    if not contents:
        raise InvalidPhotoError("File is empty")
    if not contents.startswith(PDF_SIGNATURE):
        raise InvalidPhotoError("File content is not a valid PDF")
    try:
        document = pymupdf.open(stream=contents, filetype="pdf")
    except (pymupdf.FileDataError, RuntimeError) as error:
        raise InvalidPhotoError("PDF could not be read") from error
    if document.needs_pass:
        document.close()
        raise InvalidPhotoError("PDF is encrypted and cannot be read")
    if document.page_count == 0:
        document.close()
        raise InvalidPhotoError("PDF contains no pages")
    return document


def _render_page_png(page) -> bytes:
    rect = page.rect
    page_area = rect.width * rect.height
    if not math.isfinite(page_area) or page_area <= 0:
        raise InvalidPhotoError("PDF page has invalid dimensions")

    scale = min(MAX_RENDER_SCALE, math.sqrt(MAX_RENDERED_PIXELS / page_area))
    if scale < MIN_RENDER_SCALE:
        raise InvalidPhotoError("PDF page is too large to process")

    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
    image = pixmap.tobytes("png")
    if len(image) > MAX_PHOTO_SIZE_BYTES:
        raise InvalidPhotoError("File exceeds the 10MB size limit")
    return image


def first_page_as_png(contents: bytes) -> bytes:
    document = _open_pdf(contents)
    try:
        return _render_page_png(document.load_page(0))
    finally:
        document.close()


def extract_pdf_pages(contents: bytes) -> List[dict]:
    """One entry per page: its digital text, and a rendered PNG when the text is too short to be real."""
    document = _open_pdf(contents)
    try:
        pages = []
        for index in range(document.page_count):
            page = document.load_page(index)
            text = page.get_text().strip()
            png = _render_page_png(page) if len(text) < MIN_TEXT_PER_PAGE else None
            pages.append({"text": text, "png": png})
        return pages
    finally:
        document.close()
