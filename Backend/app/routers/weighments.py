from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import WEIGH_ROLES, require_roles
from app.database import get_db
from app.integrations import AdapterError, log_adapter_failure
from app.integrations.weighbridge_indicator import get_indicator_adapter
from app.models import User, VehicleEntry
from app.schemas import IndicatorReadingOut, WeighmentCreate, WeighmentOut
from app.weighing import INDICATOR_FAILED_DETAIL, capture_weighment

# Indicator reading and weighment capture (spec 8.3); paths span /api/weighbridge and /api/entries.
require_weigh = require_roles(*WEIGH_ROLES)
router = APIRouter(tags=["weighments"], dependencies=[Depends(require_weigh)])

ENTRY_NOT_FOUND_DETAIL = "Entry not found"


@router.get("/api/weighbridge/reading", response_model=IndicatorReadingOut)
def read_indicator():
    """Live reading for display only; captures re-read the indicator on the server."""
    adapter = get_indicator_adapter()
    if not adapter.available:
        return IndicatorReadingOut(available=False)
    try:
        data = adapter.read()
    except AdapterError as exc:
        log_adapter_failure("weighbridge", exc)
        raise HTTPException(status_code=502, detail=INDICATOR_FAILED_DETAIL)
    return IndicatorReadingOut(
        available=True, weight_kg=data["weight_kg"], stable=data["stable"],
        frame_ref=data.get("frame_ref"), read_at=datetime.utcnow(),
    )


@router.post("/api/entries/{entry_id}/weighments", response_model=WeighmentOut, status_code=201)
def create_weighment(
    entry_id: int,
    payload: WeighmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_weigh),
):
    # Row lock so two operators capturing at once cannot both supersede the same row.
    entry = db.query(VehicleEntry).filter(VehicleEntry.id == entry_id).with_for_update().first()
    if not entry:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND_DETAIL)
    row = capture_weighment(db, entry, payload, current_user)
    db.commit()
    db.refresh(row)
    return row
