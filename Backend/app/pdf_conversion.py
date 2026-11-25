import math

import pymupdf

from app.photo_storage import InvalidPhotoError, MAX_PHOTO_SIZE_BYTES

PDF_SIGNATURE = b"%PDF-"
MAX_RENDERED_PIXELS = 16_000_000
MAX_RENDER_SCALE = 2.0
MIN_RENDER_SCALE = 0.5


def first_page_as_png(contents: bytes) -> bytes:
    if not contents:
        raise InvalidPhotoError("File is empty")
    if not contents.startswith(PDF_SIGNATURE):
        raise InvalidPhotoError("File content is not a valid PDF")

    try:
        with pymupdf.open(stream=contents, filetype="pdf") as document:
            if document.needs_pass:
                raise InvalidPhotoError("PDF is encrypted and cannot be read")
            if document.page_count == 0:
                raise InvalidPhotoError("PDF contains no pages")

            page = document.load_page(0)
            rect = page.rect
            page_area = rect.width * rect.height
            if not math.isfinite(page_area) or page_area <= 0:
                raise InvalidPhotoError("PDF first page has invalid dimensions")

            scale = min(MAX_RENDER_SCALE, math.sqrt(MAX_RENDERED_PIXELS / page_area))
            if scale < MIN_RENDER_SCALE:
                raise InvalidPhotoError("PDF first page is too large to process")

            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
            image = pixmap.tobytes("png")
    except (pymupdf.FileDataError, RuntimeError) as error:
        raise InvalidPhotoError("PDF could not be read") from error

    if len(image) > MAX_PHOTO_SIZE_BYTES:
        raise InvalidPhotoError("File exceeds the 10MB size limit")
    return image
