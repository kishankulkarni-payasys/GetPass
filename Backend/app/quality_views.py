"""Response shapes for the quality queue, quality results and the external Quality app."""

from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session, selectinload

from app.inward_schemas import (
    PendingInspection,
    PendingInspectionLine,
    QualityQueueItem,
    QualityResultLineOut,
    QualityResultOut,
)
from app.models import QualityResult, VehicleEntry
from app.pass_queries import elapsed_minutes, utc_now_naive
from app.pass_states import PASS_TYPE_INWARD, QUALITY_PENDING, QUALITY_RESOLVED
from app.quality_results import get_current_results_by_entry
from app.schemas import ChallanLineOut
from app.site_settings import QUALITY_SLA_MINUTES

QUEUE_STATES = (QUALITY_PENDING, QUALITY_RESOLVED)


def quality_result_out(result: QualityResult) -> QualityResultOut:
    return QualityResultOut(
        id=result.id,
        entry_id=result.entry_id,
        result=result.result,
        source=result.source,
        inspected_by_name=result.inspected_by_name,
        inspected_at=result.inspected_at,
        recorded_at=result.recorded_at,
        remarks=result.remarks,
        lines=[
            QualityResultLineOut(
                challan_line_id=line.challan_line_id,
                accepted_qty=float(line.accepted_qty),
                rejected_qty=float(line.rejected_qty),
                remarks=line.remarks,
            )
            for line in result.lines
        ],
    )


def challan_lines_out(entry: VehicleEntry) -> List[ChallanLineOut]:
    return [ChallanLineOut.model_validate(line) for line in entry.challan_lines]


def _queue_entries(db: Session, states) -> List[VehicleEntry]:
    return (
        db.query(VehicleEntry)
        .options(selectinload(VehicleEntry.challan_lines))
        .filter(VehicleEntry.pass_type == PASS_TYPE_INWARD, VehicleEntry.pass_state.in_(states))
        .order_by(VehicleEntry.pass_state_changed_at.asc(), VehicleEntry.id.asc())
        .all()
    )


def _queue_item(entry: VehicleEntry, current: Optional[QualityResult], now: datetime) -> QualityQueueItem:
    minutes = elapsed_minutes(entry.pass_state_changed_at, now)
    waiting = entry.pass_state == QUALITY_PENDING
    return QualityQueueItem(
        id=entry.id,
        vehicle_number=entry.vehicle_number,
        supplier=entry.supplier_transporter_name,
        po_number=entry.po_number,
        challan_number=entry.challan_number,
        pass_state=entry.pass_state,
        pass_state_changed_at=entry.pass_state_changed_at,
        minutes_in_state=minutes,
        over_sla=waiting and minutes is not None and minutes > QUALITY_SLA_MINUTES,
        challan_lines=challan_lines_out(entry),
        current_result=quality_result_out(current) if current is not None else None,
    )


def build_quality_queue(db: Session) -> List[QualityQueueItem]:
    """Passes awaiting a result, then resolved ones still correctable (oldest first)."""
    entries = _queue_entries(db, QUEUE_STATES)
    currents: Dict[int, QualityResult] = get_current_results_by_entry(db, [entry.id for entry in entries])
    now = utc_now_naive()
    return [_queue_item(entry, currents.get(entry.id), now) for entry in entries]


def pending_inspection(entry: VehicleEntry) -> PendingInspection:
    """Shape used by the Quality app's pull endpoint and the InspectionRequested outbox event."""
    return PendingInspection(
        pass_id=entry.id,
        po_no=entry.po_number,
        supplier=entry.supplier_transporter_name,
        vehicle_no=entry.vehicle_number,
        challan_no=entry.challan_number,
        lines=[
            PendingInspectionLine(line_no=line.line_no, material=line.material, qty=float(line.quantity), uom=line.uom)
            for line in entry.challan_lines
        ],
        sent_at=entry.pass_state_changed_at,
    )


def build_pending_inspections(db: Session) -> List[PendingInspection]:
    return [pending_inspection(entry) for entry in _queue_entries(db, (QUALITY_PENDING,))]
