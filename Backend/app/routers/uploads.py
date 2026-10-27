import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.auth import get_current_user
from app.photo_storage import MEDIA_TYPES_BY_EXTENSION, UPLOAD_ROOT

PHOTO_FILENAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")
PHOTO_NOT_FOUND_DETAIL = "Photo not found"

# Photos were previously served publicly; serving them through a router keeps the
# same /uploads URLs while requiring a signed-in user.
router = APIRouter(tags=["uploads"], dependencies=[Depends(get_current_user)])


@router.api_route("/uploads/entries/{entry_id}/{filename}", methods=["GET", "HEAD"])
def get_entry_photo(entry_id: int, filename: str):
    if not PHOTO_FILENAME_PATTERN.fullmatch(filename):
        raise HTTPException(status_code=404, detail=PHOTO_NOT_FOUND_DETAIL)

    upload_root = UPLOAD_ROOT.resolve()
    photo_path = (upload_root / str(entry_id) / filename).resolve()
    if not photo_path.is_relative_to(upload_root) or not photo_path.is_file():
        raise HTTPException(status_code=404, detail=PHOTO_NOT_FOUND_DETAIL)

    media_type = MEDIA_TYPES_BY_EXTENSION[photo_path.suffix]
    return FileResponse(
        photo_path,
        media_type=media_type,
        headers={"X-Content-Type-Options": "nosniff"},
    )
