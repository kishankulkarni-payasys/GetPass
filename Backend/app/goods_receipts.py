"""GRN draft, line edits and approval (spec 8.6, rules B6, B9, B11, B12, B14)."""

import json
import logging
import uuid
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Sequence, Set

from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.inward_schemas import GrnLineEdit
from app.models import GoodsReceipt, GoodsReceiptLine, PassWeighment, QualityResult, User, VehicleEntry
from app.pass_states import (
    ERP_STATUS_NOT_REQUIRED,
    ERP_STATUS_POSTED,
    GRN_DRAFT,
    apply_transition,
    ensure_state_in,
    is_transition_allowed,
    raise_state_conflict,
)
from app.quality_results import get_current_quality_result
from app.site_settings import site_today
from app.pass_queries import utc_now_naive

logger = logging.getLogger(__name__)

GRN_STATUS_DRAFT = "draft"
GRN_STATUS_APPROVED = "approved"
# ERP post status (spec 5.3); posted / not_required come from pass_states, which maps them to display states.
ERP_NOT_REQUIRED = ERP_STATUS_NOT_REQUIRED
ERP_PENDING = "pending"
ERP_POSTED = ERP_STATUS_POSTED
ERP_FAILED = "failed"
START_TRANSITION = "T5"
APPROVE_TRANSITION = "T6"
IDEMPOTENCY_KEY_PREFIX = "gatepass-grn-"
RETURN_PASS_PREFIX = "RRP"
RETURN_PASS_SEQUENCE_DIGITS = 5
RETURN_PASS_LOCK_RESOURCE = "gatepass_return_pass_number"
RETURN_PASS_LOCK_TIMEOUT_MS = 10_000
LINE_EDITED_ACTION = "grn_line_edited"
APPROVED_ACTION = "grn_approved"
EDITABLE_QTY_FIELDS = ("received_qty", "accepted_qty", "rejected_qty")
REMARKS_FIELD = "remarks"
ZERO = Decimal("0")

QUALITY_REQUIRED_DETAIL = "Quality result is required before a GRN"
GRN_NOT_FOUND_DETAIL = "GRN not found"
GRN_LINE_NOT_FOUND_DETAIL = "GRN line not found"
SOD_DETAIL = "The GRN approver must be different from the weighbridge operator"

# Serialises return out-pass numbering across concurrent approvals; held until commit.
_RETURN_PASS_LOCK_SQL = text(
    "SET NOCOUNT ON; DECLARE @lock_result INT; "
    "EXEC @lock_result = sp_getapplock @Resource = :resource, @LockMode = 'Exclusive', "
    "@LockOwner = 'Transaction', @LockTimeout = :timeout_ms; SELECT @lock_result;"
)


def get_receipt(db: Session, entry_id: int) -> Optional[GoodsReceipt]:
    return db.query(GoodsReceipt).filter(GoodsReceipt.entry_id == entry_id).first()


def get_receipt_or_404(db: Session, entry_id: int) -> GoodsReceipt:
    receipt = get_receipt(db, entry_id)
    if receipt is None:
        raise HTTPException(status_code=404, detail=GRN_NOT_FOUND_DETAIL)
    return receipt


def ordered_lines(receipt: GoodsReceipt) -> List[GoodsReceiptLine]:
    return sorted(receipt.lines, key=lambda line: line.id or 0)


# ---- T5: start the draft ----

def start_goods_receipt(db: Session, entry: VehicleEntry, actor: User) -> GoodsReceipt:
    """Hard gate (B11): no GRN without a current quality result. The caller commits."""
    quality = get_current_quality_result(db, entry.id)
    if quality is None:
        raise HTTPException(status_code=409, detail=QUALITY_REQUIRED_DETAIL)
    apply_transition(db, entry, START_TRANSITION, actor=actor)
    receipt = GoodsReceipt(
        entry_id=entry.id,
        status=GRN_STATUS_DRAFT,
        created_by_id=actor.id,
        created_at=utc_now_naive(),
        erp_attempts=0,
        idempotency_key=f"{IDEMPOTENCY_KEY_PREFIX}{uuid.uuid4().hex}",
        lines=_draft_lines(entry, quality),
    )
    db.add(receipt)
    return receipt


def _draft_lines(entry: VehicleEntry, quality: QualityResult) -> List[GoodsReceiptLine]:
    """Received = challan qty; accepted / rejected from quality; PO qty from the gate-in snapshot."""
    quality_by_line = {line.challan_line_id: line for line in quality.lines}
    po_open_qty = po_open_qty_by_material(entry.po_lookup_snapshot)
    lines = []
    for challan_line in entry.challan_lines:
        quality_line = quality_by_line.get(challan_line.id)
        lines.append(
            GoodsReceiptLine(
                challan_line_id=challan_line.id,
                material=challan_line.material,
                uom=challan_line.uom,
                po_qty=po_open_qty.get(challan_line.material.strip().casefold()),
                challan_qty=challan_line.quantity,
                received_qty=challan_line.quantity,
                accepted_qty=quality_line.accepted_qty if quality_line else ZERO,
                rejected_qty=quality_line.rejected_qty if quality_line else ZERO,
                qty_edited=False,
            )
        )
    return lines


def po_open_qty_by_material(snapshot: Optional[str]) -> Dict[str, Decimal]:
    """Open qty per material from the PO snapshot taken at gate-in; first line wins on duplicates."""
    if not snapshot:
        return {}
    try:
        po = json.loads(snapshot)
    except ValueError:
        logger.warning("PO snapshot is not valid JSON; GRN PO quantities left empty")
        return {}
    po_lines = po.get("lines") if isinstance(po, dict) else None
    open_qty: Dict[str, Decimal] = {}
    for line in po_lines if isinstance(po_lines, list) else []:
        material, quantity = _snapshot_line_values(line)
        if material and quantity is not None:
            open_qty.setdefault(material, quantity)
    return open_qty


def _snapshot_line_values(line) -> tuple:
    if not isinstance(line, dict):
        return None, None
    material = str(line.get("material") or "").strip().casefold()
    try:
        quantity = Decimal(str(line.get("open_qty")))
    except (InvalidOperation, ValueError):
        return material, None
    return material, quantity if quantity.is_finite() else None


# ---- Line edits (only in GRN_DRAFT, rule B6: no cross-checks) ----

def edit_receipt_lines(db: Session, entry: VehicleEntry, receipt: GoodsReceipt, edits: Sequence[GrnLineEdit], actor: User) -> None:
    ensure_state_in(entry, frozenset({GRN_DRAFT}))
    lines = ordered_lines(receipt)
    line_numbers = {line.id: number for number, line in enumerate(lines, start=1)}
    lines_by_id = {line.id: line for line in lines}
    edit_ids = [edit.id for edit in edits]
    if len(edit_ids) != len(set(edit_ids)) or not set(edit_ids) <= set(lines_by_id):
        raise HTTPException(status_code=422, detail=GRN_LINE_NOT_FOUND_DETAIL)
    for edit in edits:
        _apply_line_edit(db, entry.id, lines_by_id[edit.id], line_numbers[edit.id], edit, actor)


def _apply_line_edit(db: Session, entry_id: int, line: GoodsReceiptLine, line_no: int, edit: GrnLineEdit, actor: User) -> None:
    sent = edit.model_fields_set
    for field in EDITABLE_QTY_FIELDS:
        new_value = getattr(edit, field)
        if field in sent and new_value is not None and new_value != getattr(line, field):
            _audit_line_change(db, entry_id, line_no, field, getattr(line, field), new_value, actor)
            setattr(line, field, new_value)
            line.qty_edited = True
    if REMARKS_FIELD in sent and edit.remarks != line.remarks:
        _audit_line_change(db, entry_id, line_no, REMARKS_FIELD, line.remarks, edit.remarks, actor)
        line.remarks = edit.remarks


def _audit_line_change(db: Session, entry_id: int, line_no: int, field: str, old, new, actor: User) -> None:
    record_audit(
        db,
        entry_id=entry_id,
        action=LINE_EDITED_ACTION,
        field=f"line {line_no} {field}",
        old_value=old,
        new_value=new,
        is_manual_override=True,
        actor=actor,
    )


# ---- T6: approve ----

def weigher_ids(db: Session, entry_id: int) -> Set[int]:
    """Users who captured any gross or tare weighment on the pass, superseded rows included."""
    rows = db.query(PassWeighment.captured_by_id).filter(PassWeighment.entry_id == entry_id).distinct()
    return {captured_by_id for (captured_by_id,) in rows if captured_by_id is not None}


def approve_goods_receipt(db: Session, entry: VehicleEntry, receipt: GoodsReceipt, actor: User) -> None:
    """Approve in-app; sets erp_status but does not post. The caller commits before posting (B13)."""
    if not is_transition_allowed(entry, APPROVE_TRANSITION):
        raise_state_conflict()
    # Segregation of duty (B9) applies to admins too.
    if actor.id in weigher_ids(db, entry.id):
        raise HTTPException(status_code=403, detail=SOD_DETAIL)
    apply_transition(db, entry, APPROVE_TRANSITION, actor=actor)
    lines = receipt.lines
    receipt.status = GRN_STATUS_APPROVED
    receipt.approved_by_id = actor.id
    receipt.approved_at = utc_now_naive()
    if sum((line.rejected_qty for line in lines), ZERO) > ZERO:
        receipt.return_pass_number = next_return_pass_number(db)
    # Nothing accepted means nothing to book in the ERP: only the return out-pass applies.
    has_accepted = sum((line.accepted_qty for line in lines), ZERO) > ZERO
    receipt.erp_status = ERP_PENDING if has_accepted else ERP_NOT_REQUIRED
    record_audit(
        db, entry_id=entry.id, action=APPROVED_ACTION, field="erp_status", new_value=receipt.erp_status, actor=actor
    )


def next_return_pass_number(db: Session) -> str:
    """Next `RRP-YYYY-NNNNN` in this year's sequence (B14); locked so two approvals never share one."""
    lock_result = db.execute(
        _RETURN_PASS_LOCK_SQL, {"resource": RETURN_PASS_LOCK_RESOURCE, "timeout_ms": RETURN_PASS_LOCK_TIMEOUT_MS}
    ).scalar()
    if lock_result is None or lock_result < 0:
        raise RuntimeError("Could not lock the return out-pass number sequence")
    prefix = f"{RETURN_PASS_PREFIX}-{site_today().year}-"
    latest = (
        db.query(func.max(GoodsReceipt.return_pass_number))
        .filter(GoodsReceipt.return_pass_number.like(f"{prefix}%"))
        .scalar()
    )
    sequence = int(latest[len(prefix):]) + 1 if latest else 1
    return f"{prefix}{sequence:0{RETURN_PASS_SEQUENCE_DIGITS}d}"
