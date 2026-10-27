from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_entry_write, require_weighbridge_write
from app.database import get_db
from app.models import User, VehicleEntry, VehicleEntryPhoto
from app.photo_storage import (
    InvalidPhotoError,
    delete_entry_photos,
    read_upload_capped,
    validate_photo,
    write_entry_photo,
)
from app.schemas import PhotoOut, VehicleEntryCreate, VehicleEntryOut, WeightUpdate

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(get_current_user)])

LIKE_ESCAPE_CHAR = "\\"


def _to_naive_utc(value: datetime) -> datetime:
    # Columns store naive UTC; aware inputs (e.g. "...Z") must be shifted to UTC before comparing.
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _escape_like(value: str) -> str:
    return (
        value.replace(LIKE_ESCAPE_CHAR, LIKE_ESCAPE_CHAR * 2)
        .replace("%", f"{LIKE_ESCAPE_CHAR}%")
        .replace("_", f"{LIKE_ESCAPE_CHAR}_")
        # SQL Server treats [..] as a character class inside LIKE.
        .replace("[", f"{LIKE_ESCAPE_CHAR}[")
    )


@router.post("", response_model=VehicleEntryOut, status_code=201, dependencies=[Depends(require_entry_write)])
def create_entry(entry: VehicleEntryCreate, db: Session = Depends(get_db)):
    db_entry = VehicleEntry(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.get("", response_model=List[VehicleEntryOut])
def list_entries(
    vehicle_number: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    weighed: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(VehicleEntry)
    if vehicle_number:
        pattern = f"%{_escape_like(vehicle_number)}%"
        query = query.filter(VehicleEntry.vehicle_number.ilike(pattern, escape=LIKE_ESCAPE_CHAR))
    if date_from:
        query = query.filter(VehicleEntry.entry_time >= _to_naive_utc(date_from))
    if date_to:
        query = query.filter(VehicleEntry.entry_time <= _to_naive_utc(date_to))
    if weighed is True:
        query = query.filter(VehicleEntry.gross_weight.isnot(None))
    elif weighed is False:
        query = query.filter(VehicleEntry.gross_weight.is_(None))
    return query.order_by(VehicleEntry.entry_time.desc()).all()


@router.get("/{entry_id}", response_model=VehicleEntryOut)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/{entry_id}/exit", response_model=VehicleEntryOut, dependencies=[Depends(require_entry_write)])
def mark_exit(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.exit_time is not None:
        raise HTTPException(status_code=400, detail="Entry already marked as exited")
    entry.exit_time = datetime.utcnow()
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}/weight", response_model=VehicleEntryOut, dependencies=[Depends(require_weighbridge_write)])
def record_weight(
    entry_id: int,
    payload: WeightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.gross_weight = payload.gross_weight
    entry.weight_unit = payload.weight_unit or "kg"
    entry.weighed_at = datetime.utcnow()
    entry.weighed_by_id = current_user.id
    db.commit()
    db.refresh(entry)
    return entry


async def _read_and_validate_uploads(files: List[UploadFile]) -> List[Tuple[bytes, str]]:
    # Every file is checked before any is written, so one bad file cannot leave orphans on disk.
    validated = []
    for upload_file in files:
        try:
            contents = await read_upload_capped(upload_file)
            extension = validate_photo(upload_file.content_type, contents)
        except InvalidPhotoError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        validated.append((contents, extension))
    return validated


@router.post("/{entry_id}/photos", response_model=List[PhotoOut], status_code=201, dependencies=[Depends(require_weighbridge_write)])
async def upload_photos(
    entry_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    validated_uploads = await _read_and_validate_uploads(files)

    written_paths = []
    created_photos = []
    try:
        for contents, extension in validated_uploads:
            file_path = write_entry_photo(entry_id, contents, extension)
            written_paths.append(file_path)
            photo = VehicleEntryPhoto(entry_id=entry_id, file_path=file_path, uploaded_by_id=current_user.id)
            db.add(photo)
            created_photos.append(photo)
        db.commit()
    except Exception:
        db.rollback()
        delete_entry_photos(written_paths)
        raise

    for photo in created_photos:
        db.refresh(photo)
    return created_photos
