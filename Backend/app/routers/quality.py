from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import QUALITY_ROLES, STORE_ROLES, get_current_user, require_roles
from app.database import get_db
from app.integration_events import INSPECTION_REQUESTED_EVENT, INSPECTION_REQUESTED_VERSION, record_event
from app.inward_schemas import QualityQueueItem, QualityResultIn, QualityResultSaved
from app.models import User
from app.pass_queries import get_entry_or_404, utc_now_naive
from app.pass_states import apply_transition
from app.pass_views import to_entry_out
from app.quality_results import SOURCE_IN_APP, Inspection, QualityLineValues, record_quality_result
from app.quality_views import build_quality_queue, pending_inspection, quality_result_out
from app.schemas import VehicleEntryOut

# Send-to-quality, quality queue and in-app quality result (spec 8.4).
router = APIRouter(tags=["quality"], dependencies=[Depends(get_current_user)])

SEND_TO_QUALITY_TRANSITION = "T3"

require_store = require_roles(*STORE_ROLES)
require_quality = require_roles(*QUALITY_ROLES)


@router.post("/api/entries/{entry_id}/send-to-quality", response_model=VehicleEntryOut)
def send_to_quality(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_store)):
    """T3: material is unloaded; the pass waits for inspection (the hard gate)."""
    entry = get_entry_or_404(db, entry_id, for_update=True)
    apply_transition(db, entry, SEND_TO_QUALITY_TRANSITION, actor=current_user)
    record_event(
        db,
        INSPECTION_REQUESTED_EVENT,
        INSPECTION_REQUESTED_VERSION,
        entry.id,
        pending_inspection(entry).model_dump(mode="json"),
    )
    db.commit()
    db.refresh(entry)
    return to_entry_out(entry)


@router.get("/api/quality/queue", response_model=List[QualityQueueItem], dependencies=[Depends(require_quality)])
def get_quality_queue(db: Session = Depends(get_db)):
    return build_quality_queue(db)


@router.put("/api/entries/{entry_id}/quality-result", response_model=QualityResultSaved)
def put_quality_result(
    entry_id: int,
    payload: QualityResultIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_quality),
):
    """T4 (first result) or T4b (correction before a GRN exists); the result is derived from the lines."""
    entry = get_entry_or_404(db, entry_id, for_update=True)
    inspection = Inspection(
        source=SOURCE_IN_APP,
        lines=tuple(
            QualityLineValues(line.challan_line_id, line.accepted_qty, line.rejected_qty, line.remarks)
            for line in payload.lines
        ),
        remarks=payload.remarks,
        inspected_by_name=current_user.full_name,
        inspected_by_id=current_user.id,
        inspected_at=utc_now_naive(),
    )
    result = record_quality_result(db, entry, inspection, actor=current_user)
    db.commit()
    db.refresh(result)
    return QualityResultSaved(pass_state=entry.pass_state, quality_result=quality_result_out(result))
