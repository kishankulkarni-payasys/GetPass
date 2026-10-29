"""Recording and correcting quality results (spec 8.4, 8.5, rules B10 and B11)."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from fastapi import HTTPException
from sqlalchemy import true
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.models import GoodsReceipt, PassChallanLine, QualityResult, QualityResultLine, User, VehicleEntry
from app.pass_queries import chunked, utc_now_naive
from app.pass_states import QUALITY_PENDING, QUALITY_RESOLVED, apply_transition, ensure_state_in, raise_state_conflict

RESULT_APPROVED = "approved"
RESULT_REJECTED = "rejected"
RESULT_PARTIAL = "partial"
SOURCE_IN_APP = "in_app"
SOURCE_SERVICE = "service"
RECORD_TRANSITION = "T4"
RECORDED_ACTION = "quality_result_recorded"
CORRECTED_ACTION = "quality_result_corrected"
RESULT_AUDIT_FIELD = "quality_result"
LINES_INCOMPLETE_DETAIL = "Every challan line needs a quality result"
RESULT_MISMATCH_DETAIL = "Quality result does not match the line quantities"
ZERO = Decimal("0")


@dataclass(frozen=True)
class QualityLineValues:
    challan_line_id: int
    accepted_qty: Decimal
    rejected_qty: Decimal
    remarks: Optional[str] = None


@dataclass(frozen=True)
class Inspection:
    source: str
    lines: Tuple[QualityLineValues, ...]
    remarks: Optional[str] = None
    inspected_by_name: Optional[str] = None
    inspected_by_id: Optional[int] = None
    inspected_at: Optional[datetime] = None


def derive_quality_result(lines: Iterable[QualityLineValues]) -> str:
    """Rule B10, checked in the spec's order: nothing rejected wins over nothing accepted."""
    lines = list(lines)
    if all(line.rejected_qty == ZERO for line in lines):
        return RESULT_APPROVED
    if all(line.accepted_qty == ZERO for line in lines):
        return RESULT_REJECTED
    return RESULT_PARTIAL


def get_current_quality_result(db: Session, entry_id: int) -> Optional[QualityResult]:
    return (
        db.query(QualityResult)
        .filter(QualityResult.entry_id == entry_id, QualityResult.is_current == true())
        .order_by(QualityResult.id.desc())
        .first()
    )


def get_current_results_by_entry(db: Session, entry_ids: Sequence[int]) -> Dict[int, QualityResult]:
    results: Dict[int, QualityResult] = {}
    for chunk in chunked(entry_ids):
        rows = db.query(QualityResult).filter(QualityResult.entry_id.in_(chunk), QualityResult.is_current == true())
        for row in rows:
            results[row.entry_id] = row
    return results


def ensure_lines_cover_challan(entry: VehicleEntry, lines: Sequence[QualityLineValues]) -> None:
    """Every challan line exactly once, and nothing that is not a line of this pass."""
    submitted_ids = [line.challan_line_id for line in lines]
    challan_ids = {line.id for line in entry.challan_lines}
    if len(submitted_ids) != len(set(submitted_ids)) or set(submitted_ids) != challan_ids:
        raise HTTPException(status_code=422, detail=LINES_INCOMPLETE_DETAIL)


def is_same_as_current(current: Optional[QualityResult], inspection: Inspection) -> bool:
    """True when the inspection repeats the current result exactly (an idempotent replay)."""
    if current is None or current.remarks != inspection.remarks:
        return False
    stored = {(line.challan_line_id, line.accepted_qty, line.rejected_qty, line.remarks) for line in current.lines}
    incoming = {(line.challan_line_id, line.accepted_qty, line.rejected_qty, line.remarks) for line in inspection.lines}
    return stored == incoming


def _ensure_result_can_change(db: Session, entry: VehicleEntry) -> None:
    """T4 from QUALITY_PENDING, or T4b (correction) while QUALITY_RESOLVED and no GRN exists."""
    if entry.pass_state == QUALITY_PENDING:
        return
    ensure_state_in(entry, frozenset({QUALITY_RESOLVED}))
    if db.query(GoodsReceipt.id).filter(GoodsReceipt.entry_id == entry.id).first() is not None:
        raise_state_conflict()


def record_quality_result(
    db: Session,
    entry: VehicleEntry,
    inspection: Inspection,
    actor: Optional[User] = None,
    actor_service: Optional[str] = None,
) -> QualityResult:
    """Store a new current result (keeping the old one as history) and audit it; the caller commits."""
    _ensure_result_can_change(db, entry)
    ensure_lines_cover_challan(entry, inspection.lines)
    previous = get_current_quality_result(db, entry.id)
    if entry.pass_state == QUALITY_PENDING:
        apply_transition(db, entry, RECORD_TRANSITION, actor=actor, actor_service=actor_service)
    if previous is not None:
        previous.is_current = False
    result = _new_result_row(entry.id, inspection)
    db.add(result)
    record_audit(
        db,
        entry_id=entry.id,
        action=CORRECTED_ACTION if previous is not None else RECORDED_ACTION,
        field=RESULT_AUDIT_FIELD,
        old_value=previous.result if previous is not None else None,
        new_value=result.result,
        actor=actor,
        actor_service=actor_service,
    )
    return result


def _new_result_row(entry_id: int, inspection: Inspection) -> QualityResult:
    return QualityResult(
        entry_id=entry_id,
        result=derive_quality_result(inspection.lines),
        source=inspection.source,
        inspected_by_name=inspection.inspected_by_name,
        inspected_by_id=inspection.inspected_by_id,
        inspected_at=inspection.inspected_at,
        recorded_at=utc_now_naive(),
        remarks=inspection.remarks,
        is_current=True,
        lines=[
            QualityResultLine(
                challan_line_id=line.challan_line_id,
                accepted_qty=line.accepted_qty,
                rejected_qty=line.rejected_qty,
                remarks=line.remarks,
            )
            for line in inspection.lines
        ],
    )


def match_challan_line(
    challan_lines: Sequence[PassChallanLine], line_no: Optional[int], material: Optional[str]
) -> PassChallanLine:
    """Service lines match by line_no when given, else by material name (case-insensitive, exact)."""
    if line_no is not None:
        matches: List[PassChallanLine] = [line for line in challan_lines if line.line_no == line_no]
    else:
        wanted = (material or "").strip().casefold()
        matches = [line for line in challan_lines if wanted and line.material.strip().casefold() == wanted]
    # Two challan lines with the same material cannot be told apart without a line_no.
    if len(matches) != 1:
        raise HTTPException(status_code=422, detail=LINES_INCOMPLETE_DETAIL)
    return matches[0]
