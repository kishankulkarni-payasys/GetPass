from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import VehicleEntry
from app.schemas import VehicleEntryCreate, VehicleEntryOut

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=VehicleEntryOut, status_code=201)
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
    db: Session = Depends(get_db),
):
    query = db.query(VehicleEntry)
    if vehicle_number:
        query = query.filter(VehicleEntry.vehicle_number.ilike(f"%{vehicle_number}%"))
    if date_from:
        query = query.filter(VehicleEntry.entry_time >= date_from)
    if date_to:
        query = query.filter(VehicleEntry.entry_time <= date_to)
    return query.order_by(VehicleEntry.entry_time.desc()).all()


@router.get("/{entry_id}", response_model=VehicleEntryOut)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/{entry_id}/exit", response_model=VehicleEntryOut)
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
