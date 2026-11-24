"""Builds API responses for passes: computed display state, dwell time and the full detail view."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import GoodsReceipt, PassAuditLog, QualityResult, User, VehicleEntry
from app.pass_states import display_state
from app.schemas import (
    AuditOut,
    ChallanLineOut,
    GrnSummary,
    PassDetailOut,
    QualityLineSummary,
    QualitySummary,
    VehicleEntryOut,
    WeighmentOut,
)
from app.weighing import current_weights_kg, superseded_ids

SECONDS_PER_MINUTE = 60
AUDIT_TIMELINE_LIMIT = 100


def dwell_minutes(entry: VehicleEntry, now: Optional[datetime] = None) -> int:
    end = entry.exit_time or now or datetime.utcnow()
    return max(0, int((end - entry.entry_time).total_seconds() // SECONDS_PER_MINUTE))


def _erp_status(entry: VehicleEntry) -> Optional[str]:
    return entry.goods_receipt.erp_status if entry.goods_receipt else None


def to_entry_out(entry: VehicleEntry, now: Optional[datetime] = None) -> VehicleEntryOut:
    out = VehicleEntryOut.model_validate(entry)
    out.erp_status = _erp_status(entry)
    out.display_state = display_state(entry.pass_state, out.erp_status)
    out.dwell_minutes = dwell_minutes(entry, now)
    out.current_gross_kg, out.current_tare_kg = current_weights_kg(entry)
    if out.current_gross_kg is not None and out.current_tare_kg is not None:
        # Informational only (B8): never drives GRN quantities.
        out.net_kg = out.current_gross_kg - out.current_tare_kg
    return out


def _weighments_out(db: Session, entry: VehicleEntry) -> List[WeighmentOut]:
    superseded = superseded_ids(db, entry.id)
    result = []
    for row in entry.weighments:
        item = WeighmentOut.model_validate(row)
        item.is_superseded = row.id in superseded
        result.append(item)
    return result


def _quality_out(entry: VehicleEntry) -> Optional[QualitySummary]:
    current: Optional[QualityResult] = next((q for q in entry.quality_results if q.is_current), None)
    if current is None:
        return None
    return QualitySummary(
        result=current.result, source=current.source, inspected_by_name=current.inspected_by_name,
        inspected_at=current.inspected_at, remarks=current.remarks,
        lines=[QualityLineSummary(challan_line_id=line.challan_line_id, accepted_qty=float(line.accepted_qty),
                                  rejected_qty=float(line.rejected_qty), remarks=line.remarks)
               for line in current.lines],
    )


def _grn_out(receipt: Optional[GoodsReceipt]) -> Optional[GrnSummary]:
    if receipt is None:
        return None
    return GrnSummary(
        status=receipt.status, erp_status=receipt.erp_status, erp_grn_number=receipt.erp_grn_number,
        return_pass_number=receipt.return_pass_number, approved_at=receipt.approved_at,
        total_rejected_qty=sum(float(line.rejected_qty) for line in receipt.lines),
    )


def _audit_out(db: Session, entry_id: int) -> List[AuditOut]:
    rows = (
        db.query(PassAuditLog, User.full_name)
        .outerjoin(User, User.id == PassAuditLog.actor_user_id)
        .filter(PassAuditLog.entry_id == entry_id)
        .order_by(PassAuditLog.created_at.desc(), PassAuditLog.id.desc())
        .limit(AUDIT_TIMELINE_LIMIT)
        .all()
    )
    result = []
    for row, actor_name in rows:
        item = AuditOut.model_validate(row)
        item.actor_name = actor_name
        result.append(item)
    return result


def to_detail_out(db: Session, entry: VehicleEntry) -> PassDetailOut:
    base = to_entry_out(entry)
    return PassDetailOut(
        **base.model_dump(),
        challan_lines=[ChallanLineOut.model_validate(line) for line in entry.challan_lines],
        weighments=_weighments_out(db, entry),
        quality=_quality_out(entry),
        grn=_grn_out(entry.goods_receipt),
        audit=_audit_out(db, entry.id),
    )
