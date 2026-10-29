"""Response shapes for GRN screens: the GRN with informational flags (B7) and the store work list."""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Sequence

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.goods_receipts import (
    ERP_FAILED,
    ERP_PENDING,
    GRN_STATUS_APPROVED,
    GRN_STATUS_DRAFT,
    ordered_lines,
    weigher_ids,
)
from app.inward_schemas import GrnLineOut, GrnOut, GrnWorkItem, PersonOut
from app.models import GoodsReceipt, GoodsReceiptLine, User, VehicleEntry
from app.pass_queries import chunked, elapsed_minutes, utc_now_naive
from app.pass_states import ON_SITE, PASS_TYPE_INWARD, QUALITY_RESOLVED
from app.quality_results import get_current_quality_result

FLAG_RECEIVED_VS_CHALLAN = "received_differs_from_challan"
FLAG_SPLIT_VS_RECEIVED = "accepted_rejected_differ_from_received"
FLAG_RECEIVED_VS_PO = "received_differs_from_po"
FLAG_ACCEPTED_VS_QUALITY = "accepted_differs_from_quality"
GROUP_SEND_FOR_INSPECTION = "send_for_inspection"
GROUP_READY_FOR_GRN = "ready_for_grn"
GROUP_DRAFT = "draft"
GROUP_PENDING_POST = "pending_post"
GROUP_APPROVED = "approved"
PENDING_POST_STATUSES = (ERP_PENDING, ERP_FAILED)
ZERO = Decimal("0")


def line_flags(line: GoodsReceiptLine, quality_accepted: Optional[Decimal]) -> List[str]:
    flags = []
    if line.received_qty != line.challan_qty:
        flags.append(FLAG_RECEIVED_VS_CHALLAN)
    if line.accepted_qty + line.rejected_qty != line.received_qty:
        flags.append(FLAG_SPLIT_VS_RECEIVED)
    if line.po_qty is not None and line.received_qty != line.po_qty:
        flags.append(FLAG_RECEIVED_VS_PO)
    if quality_accepted is not None and line.accepted_qty != quality_accepted:
        flags.append(FLAG_ACCEPTED_VS_QUALITY)
    return flags


def _line_out(line: GoodsReceiptLine, line_no: int, quality_accepted: Optional[Decimal]) -> GrnLineOut:
    return GrnLineOut(
        id=line.id,
        line_no=line_no,
        challan_line_id=line.challan_line_id,
        material=line.material,
        uom=line.uom,
        po_qty=float(line.po_qty) if line.po_qty is not None else None,
        challan_qty=float(line.challan_qty),
        received_qty=float(line.received_qty),
        accepted_qty=float(line.accepted_qty),
        rejected_qty=float(line.rejected_qty),
        quality_accepted_qty=float(quality_accepted) if quality_accepted is not None else None,
        qty_edited=bool(line.qty_edited),
        remarks=line.remarks,
        flags=line_flags(line, quality_accepted),
    )


def _people(db: Session, user_ids: Sequence[int]) -> List[PersonOut]:
    if not user_ids:
        return []
    users = db.query(User).filter(User.id.in_(list(user_ids))).order_by(User.full_name).all()
    return [PersonOut(id=user.id, full_name=user.full_name) for user in users]


def _total(lines: Sequence[GoodsReceiptLine], field: str) -> float:
    return float(sum((getattr(line, field) for line in lines), ZERO))


def build_grn_out(db: Session, entry: VehicleEntry, receipt: GoodsReceipt, current_user: User) -> GrnOut:
    quality = get_current_quality_result(db, entry.id)
    quality_accepted = {line.challan_line_id: line.accepted_qty for line in quality.lines} if quality else {}
    weighers = weigher_ids(db, entry.id)
    approvers = _people(db, [receipt.approved_by_id]) if receipt.approved_by_id else []
    lines = ordered_lines(receipt)
    return GrnOut(
        id=receipt.id,
        entry_id=entry.id,
        pass_state=entry.pass_state,
        status=receipt.status,
        created_by_id=receipt.created_by_id,
        created_at=receipt.created_at,
        approved_by=approvers[0] if approvers else None,
        approved_at=receipt.approved_at,
        erp_status=receipt.erp_status,
        erp_grn_number=receipt.erp_grn_number,
        erp_attempts=receipt.erp_attempts or 0,
        erp_last_error=receipt.erp_last_error,
        erp_last_attempt_at=receipt.erp_last_attempt_at,
        return_pass_number=receipt.return_pass_number,
        total_received_qty=_total(lines, "received_qty"),
        total_accepted_qty=_total(lines, "accepted_qty"),
        total_rejected_qty=_total(lines, "rejected_qty"),
        quality_result=quality.result if quality else None,
        inspected_by_name=quality.inspected_by_name if quality else None,
        weighed_by=_people(db, sorted(weighers)),
        current_user_weighed=current_user.id in weighers,
        lines=[
            _line_out(line, number, quality_accepted.get(line.challan_line_id))
            for number, line in enumerate(lines, start=1)
        ],
    )


# ---- Store work list ----

def _entry_work_item(entry: VehicleEntry, group: str, now: datetime, receipt: Optional[GoodsReceipt] = None) -> GrnWorkItem:
    return GrnWorkItem(
        entry_id=entry.id,
        group=group,
        vehicle_number=entry.vehicle_number,
        supplier=entry.supplier_transporter_name,
        po_number=entry.po_number,
        challan_number=entry.challan_number,
        pass_state=entry.pass_state,
        minutes_in_state=elapsed_minutes(entry.pass_state_changed_at, now),
        grn_id=receipt.id if receipt else None,
        grn_status=receipt.status if receipt else None,
        erp_status=receipt.erp_status if receipt else None,
        erp_attempts=receipt.erp_attempts if receipt else None,
        erp_last_error=receipt.erp_last_error if receipt else None,
        return_pass_number=receipt.return_pass_number if receipt else None,
    )


def _passes_without_grn(db: Session, now: datetime) -> List[GrnWorkItem]:
    entries = (
        db.query(VehicleEntry)
        .filter(VehicleEntry.pass_type == PASS_TYPE_INWARD, VehicleEntry.pass_state.in_((ON_SITE, QUALITY_RESOLVED)))
        .order_by(VehicleEntry.pass_state_changed_at.asc(), VehicleEntry.id.asc())
        .all()
    )
    groups = {ON_SITE: GROUP_SEND_FOR_INSPECTION, QUALITY_RESOLVED: GROUP_READY_FOR_GRN}
    return [_entry_work_item(entry, groups[entry.pass_state], now) for entry in entries]


def _receipt_filter(status: Optional[str], erp_status: Optional[str]):
    if status is None and erp_status is None:
        return or_(
            GoodsReceipt.status == GRN_STATUS_DRAFT,
            and_(GoodsReceipt.status == GRN_STATUS_APPROVED, GoodsReceipt.erp_status.in_(PENDING_POST_STATUSES)),
        )
    conditions = []
    if status is not None:
        conditions.append(GoodsReceipt.status == status)
    if erp_status is not None:
        conditions.append(GoodsReceipt.erp_status == erp_status)
    elif status == GRN_STATUS_APPROVED:
        conditions.append(GoodsReceipt.erp_status.in_(PENDING_POST_STATUSES))
    return and_(*conditions)


def _receipt_group(receipt: GoodsReceipt) -> str:
    if receipt.status == GRN_STATUS_DRAFT:
        return GROUP_DRAFT
    return GROUP_PENDING_POST if receipt.erp_status in PENDING_POST_STATUSES else GROUP_APPROVED


def _receipt_items(db: Session, status: Optional[str], erp_status: Optional[str], now: datetime) -> List[GrnWorkItem]:
    receipts = (
        db.query(GoodsReceipt)
        .filter(_receipt_filter(status, erp_status))
        .order_by(GoodsReceipt.created_at.asc(), GoodsReceipt.id.asc())
        .all()
    )
    entries: Dict[int, VehicleEntry] = {}
    for chunk in chunked([receipt.entry_id for receipt in receipts]):
        entries.update({entry.id: entry for entry in db.query(VehicleEntry).filter(VehicleEntry.id.in_(chunk))})
    return [
        _entry_work_item(
            entries[receipt.entry_id],
            _receipt_group(receipt),
            now,
            receipt,
        )
        for receipt in receipts
    ]


def build_store_work_list(db: Session, status: Optional[str], erp_status: Optional[str]) -> List[GrnWorkItem]:
    """Without filters: send for inspection, ready for GRN, drafts, approved but not yet posted."""
    now = utc_now_naive()
    items = _passes_without_grn(db, now) if status is None and erp_status is None else []
    return items + _receipt_items(db, status, erp_status, now)
