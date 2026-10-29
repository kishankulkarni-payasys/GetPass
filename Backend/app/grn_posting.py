"""Posting an approved GRN to the ERP and recording the outcome (spec 8.6, rule B13)."""

import logging
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.audit import record_audit
from app.goods_receipts import ERP_FAILED, ERP_PENDING, ERP_POSTED
from app.integration_events import GRN_POSTED_EVENT, GRN_POSTED_VERSION, record_event
from app.integrations.grn_writer import GrnWriteError, get_grn_writer
from app.models import GoodsReceipt, User, VehicleEntry
from app.pass_queries import utc_now_naive

logger = logging.getLogger(__name__)

POSTABLE_ERP_STATUSES = frozenset({ERP_PENDING, ERP_FAILED})
POST_ATTEMPT_ACTION = "erp_post_attempt"
MAX_ERROR_LENGTH = 500

# Built at import so a misconfigured http writer stops the API at startup, not at the first approval.
get_grn_writer()


def _quantity(value) -> Optional[float]:
    return float(value) if value is not None else None


def build_erp_payload(entry: VehicleEntry, receipt: GoodsReceipt) -> Dict[str, Any]:
    """Accepted material is what the ERP books; rejected is sent for reference only."""
    return {
        "grn_id": receipt.id,
        "pass_id": entry.id,
        "po_number": entry.po_number,
        "challan_number": entry.challan_number,
        "supplier": entry.supplier_transporter_name,
        "vehicle_number": entry.vehicle_number,
        "approved_at": receipt.approved_at.isoformat() + "Z" if receipt.approved_at else None,
        "lines": [
            {
                "material": line.material,
                "uom": line.uom,
                "po_qty": _quantity(line.po_qty),
                "challan_qty": _quantity(line.challan_qty),
                "received_qty": _quantity(line.received_qty),
                "accepted_qty": _quantity(line.accepted_qty),
                "rejected_qty": _quantity(line.rejected_qty),
            }
            for line in sorted(receipt.lines, key=lambda grn_line: grn_line.id)
        ],
    }


def _record_attempt_started(db: Session, receipt: GoodsReceipt) -> None:
    # Committed before calling the ERP: if the process dies mid-call the GRN stays `pending`
    # and the retry job picks it up with the same idempotency key.
    receipt.erp_status = ERP_PENDING
    receipt.erp_attempts = (receipt.erp_attempts or 0) + 1
    receipt.erp_last_attempt_at = utc_now_naive()
    db.commit()


def post_goods_receipt(
    db: Session,
    entry: VehicleEntry,
    receipt: GoodsReceipt,
    actor: Optional[User] = None,
    actor_service: Optional[str] = None,
) -> None:
    """Send the GRN to the ERP and store the outcome. Commits twice (before and after the call)."""
    previous_status = receipt.erp_status
    payload = build_erp_payload(entry, receipt)
    _record_attempt_started(db, receipt)
    try:
        grn_number = get_grn_writer().post_grn(payload, receipt.idempotency_key)["grn_number"]
    except GrnWriteError as exc:
        logger.warning("ERP post failed for GRN %s on attempt %s", receipt.id, receipt.erp_attempts)
        receipt.erp_status = ERP_FAILED
        receipt.erp_last_error = str(exc)[:MAX_ERROR_LENGTH]
    else:
        receipt.erp_status = ERP_POSTED
        receipt.erp_grn_number = grn_number
        receipt.erp_last_error = None
        record_event(db, GRN_POSTED_EVENT, GRN_POSTED_VERSION, entry.id, _grn_posted_payload(receipt, payload))
    record_audit(
        db,
        entry_id=entry.id,
        action=POST_ATTEMPT_ACTION,
        field="erp_status",
        old_value=previous_status,
        new_value=receipt.erp_status,
        actor=actor,
        actor_service=actor_service,
    )
    db.commit()


def _grn_posted_payload(receipt: GoodsReceipt, erp_payload: Dict[str, Any]) -> Dict[str, Any]:
    return {**erp_payload, "erp_grn_number": receipt.erp_grn_number, "posted_at": utc_now_naive().isoformat() + "Z"}
