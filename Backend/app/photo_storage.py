import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "entries"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024

EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class InvalidPhotoError(ValueError):
    pass


def save_entry_photo(entry_id: int, upload_file: UploadFile, contents: bytes) -> str:
    if upload_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidPhotoError(f"Unsupported file type: {upload_file.content_type}")
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise InvalidPhotoError("File exceeds the 10MB size limit")

    entry_dir = UPLOAD_ROOT / str(entry_id)
    entry_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{EXTENSIONS[upload_file.content_type]}"
    file_path = entry_dir / filename
    file_path.write_bytes(contents)

    return f"entries/{entry_id}/{filename}"
