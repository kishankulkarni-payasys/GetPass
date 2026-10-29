from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_quality_service
from app.database import get_db
from app.inward_schemas import PendingInspection, ServiceInspectionAck, ServiceInspectionResult
from app.models import VehicleEntry
from app.pass_queries import get_entry_or_404
from app.pass_states import QUALITY_PENDING, raise_state_conflict
from app.quality_results import (
    RESULT_MISMATCH_DETAIL,
    SOURCE_SERVICE,
    Inspection,
    QualityLineValues,
    derive_quality_result,
    get_current_quality_result,
    is_same_as_current,
    match_challan_line,
    record_quality_result,
)
from app.quality_views import build_pending_inspections

# Endpoints for the external Quality app, authenticated by shared secret (spec 8.5).
router = APIRouter(
    prefix="/api/integrations/quality",
    tags=["quality-integration"],
    dependencies=[Depends(require_quality_service)],
)


def _to_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _inspection_from_payload(entry: VehicleEntry, payload: ServiceInspectionResult) -> Inspection:
    lines = []
    for line in payload.lines:
        challan_line = match_challan_line(entry.challan_lines, line.line_no, line.material)
        lines.append(QualityLineValues(challan_line.id, line.accepted_qty, line.rejected_qty, line.remarks))
    return Inspection(
        source=SOURCE_SERVICE,
        lines=tuple(lines),
        remarks=payload.remarks,
        inspected_by_name=payload.inspected_by,
        inspected_at=_to_naive_utc(payload.inspected_at),
    )


@router.get("/pending", response_model=List[PendingInspection])
def list_pending_inspections(db: Session = Depends(get_db)):
    return build_pending_inspections(db)


@router.post("/inspection-result", response_model=ServiceInspectionAck)
def receive_inspection_result(
    payload: ServiceInspectionResult,
    db: Session = Depends(get_db),
    service_name: str = Depends(require_quality_service),
):
    """Record the Quality app's result; an exact replay of the current result is a 200 no-op."""
    entry = get_entry_or_404(db, payload.pass_id, for_update=True)
    current = get_current_quality_result(db, entry.id)
    # A pass that never reached inspection (cancelled, general, not yet unloaded) is a state error,
    # not a payload error, even though none of its lines would match.
    if current is None and entry.pass_state != QUALITY_PENDING:
        raise_state_conflict()
    inspection = _inspection_from_payload(entry, payload)
    if derive_quality_result(inspection.lines) != payload.result:
        raise HTTPException(status_code=422, detail=RESULT_MISMATCH_DETAIL)
    if is_same_as_current(current, inspection):
        return ServiceInspectionAck(pass_id=entry.id, pass_state=entry.pass_state, result=current.result, replayed=True)
    result = record_quality_result(db, entry, inspection, actor_service=service_name)
    db.commit()
    return ServiceInspectionAck(pass_id=entry.id, pass_state=entry.pass_state, result=result.result, replayed=False)
