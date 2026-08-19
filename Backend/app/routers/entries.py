from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_entry_write
from app.database import get_db
from app.models import User, VehicleEntry, VehicleEntryPhoto
from app.photo_storage import InvalidPhotoError, save_entry_photo
from app.schemas import PhotoOut, VehicleEntryCreate, VehicleEntryOut, WeightUpdate

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(get_current_user)])


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
        query = query.filter(VehicleEntry.vehicle_number.ilike(f"%{vehicle_number}%"))
    if date_from:
        query = query.filter(VehicleEntry.entry_time >= date_from)
    if date_to:
        query = query.filter(VehicleEntry.entry_time <= date_to)
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


@router.patch("/{entry_id}/weight", response_model=VehicleEntryOut)
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


@router.post("/{entry_id}/photos", response_model=List[PhotoOut], status_code=201)
async def upload_photos(
    entry_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    created_photos = []
    for upload_file in files:
        contents = await upload_file.read()
        try:
            file_path = save_entry_photo(entry_id, upload_file, contents)
        except InvalidPhotoError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        photo = VehicleEntryPhoto(entry_id=entry_id, file_path=file_path, uploaded_by_id=current_user.id)
        db.add(photo)
        created_photos.append(photo)

    db.commit()
    for photo in created_photos:
        db.refresh(photo)
    return created_photos
