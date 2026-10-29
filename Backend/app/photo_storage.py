import logging
import uuid
from pathlib import Path
from typing import Iterable, Optional

from fastapi import UploadFile

logger = logging.getLogger(__name__)

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "entries"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024

EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MEDIA_TYPES_BY_EXTENSION = {extension: media_type for media_type, extension in EXTENSIONS.items()}

JPEG_SIGNATURE = b"\xff\xd8\xff"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
RIFF_SIGNATURE = b"RIFF"
WEBP_SIGNATURE = b"WEBP"
WEBP_SIGNATURE_OFFSET = 8

ENTRY_PATH_PREFIX = "entries"

PHOTO_KIND_PLATE = "plate"
PHOTO_KIND_PO_DOC = "po_doc"
PHOTO_KIND_CHALLAN_DOC = "challan_doc"
PHOTO_KIND_WEIGH_FRAME = "weigh_frame"
PHOTO_KIND_VEHICLE = "vehicle"
PHOTO_KIND_OTHER = "other"
# Which photos each side of the gate may add (spec section 7); "other" is open to both.
GATE_IN_PHOTO_KINDS = frozenset({PHOTO_KIND_PLATE, PHOTO_KIND_PO_DOC, PHOTO_KIND_CHALLAN_DOC, PHOTO_KIND_VEHICLE, PHOTO_KIND_OTHER})
WEIGH_PHOTO_KINDS = frozenset({PHOTO_KIND_WEIGH_FRAME, PHOTO_KIND_OTHER})
PHOTO_KINDS = GATE_IN_PHOTO_KINDS | WEIGH_PHOTO_KINDS


class InvalidPhotoError(ValueError):
    pass


def detect_image_type(contents: bytes) -> Optional[str]:
    """Identify the image format from its magic number, ignoring what the client claims."""
    if contents.startswith(JPEG_SIGNATURE):
        return "image/jpeg"
    if contents.startswith(PNG_SIGNATURE):
        return "image/png"
    webp_marker = contents[WEBP_SIGNATURE_OFFSET:WEBP_SIGNATURE_OFFSET + len(WEBP_SIGNATURE)]
    if contents.startswith(RIFF_SIGNATURE) and webp_marker == WEBP_SIGNATURE:
        return "image/webp"
    return None


async def read_upload_capped(upload_file: UploadFile) -> bytes:
    # Reading one byte past the limit is enough to know the file is too large
    # without pulling an unbounded body into memory.
    contents = await upload_file.read(MAX_PHOTO_SIZE_BYTES + 1)
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise InvalidPhotoError("File exceeds the 10MB size limit")
    return contents


def validate_photo(content_type: Optional[str], contents: bytes) -> str:
    """Return the file extension to store the photo under, or raise InvalidPhotoError."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidPhotoError(f"Unsupported file type: {content_type}")
    if not contents:
        raise InvalidPhotoError("File is empty")
    detected_type = detect_image_type(contents)
    if detected_type is None:
        raise InvalidPhotoError("File content is not a valid JPEG, PNG or WEBP image")
    return EXTENSIONS[detected_type]


def write_entry_photo(entry_id: int, contents: bytes, extension: str) -> str:
    entry_dir = UPLOAD_ROOT / str(entry_id)
    entry_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{extension}"
    (entry_dir / filename).write_bytes(contents)

    return f"{ENTRY_PATH_PREFIX}/{entry_id}/{filename}"


def delete_entry_photos(relative_paths: Iterable[str]) -> None:
    """Best-effort cleanup of files written by a request that later failed."""
    failed_count = 0
    for relative_path in relative_paths:
        stored_path = UPLOAD_ROOT.parent / relative_path
        try:
            stored_path.unlink(missing_ok=True)
        except OSError:
            failed_count += 1
    # Only a count is logged: document paths must not appear in logs.
    if failed_count:
        logger.error("Could not remove %d orphaned photo file(s)", failed_count)
