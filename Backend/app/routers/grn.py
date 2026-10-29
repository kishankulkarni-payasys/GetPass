from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import GRN_LIST_ROLES, STORE_ROLES, get_current_user, require_roles
from app.database import get_db
from app.goods_receipts import (
    ERP_PENDING,
    GRN_STATUS_APPROVED,
    approve_goods_receipt,
    edit_receipt_lines,
    get_receipt_or_404,
    start_goods_receipt,
)
from app.grn_posting import POSTABLE_ERP_STATUSES, post_goods_receipt
from app.grn_views import build_grn_out, build_store_work_list
from app.inward_schemas import ErpStatus, GrnLinesEdit, GrnOut, GrnStatus, GrnWorkItem
from app.models import User
from app.pass_queries import get_entry_or_404
from app.pass_states import raise_state_conflict

# GRN draft, edit, approve and ERP retry (spec 8.6); paths span /api/grn and /api/entries.
router = APIRouter(tags=["grn"], dependencies=[Depends(get_current_user)])

ERP_NOT_PENDING_DETAIL = "ERP post is not pending"

require_store = require_roles(*STORE_ROLES)
require_grn_list = require_roles(*GRN_LIST_ROLES)


def _grn_response(db: Session, entry_id: int, current_user: User) -> GrnOut:
    entry = get_entry_or_404(db, entry_id)
    return build_grn_out(db, entry, get_receipt_or_404(db, entry_id), current_user)


@router.post("/api/entries/{entry_id}/grn", response_model=GrnOut, status_code=201)
def start_grn(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_store)):
    """T5: create the draft, pre-filled from the challan, quality result and PO snapshot."""
    entry = get_entry_or_404(db, entry_id, for_update=True)
    start_goods_receipt(db, entry, current_user)
    try:
        db.commit()
    except IntegrityError:
        # One GRN per pass (B12): a concurrent Start GRN already created it.
        db.rollback()
        raise_state_conflict()
    return _grn_response(db, entry_id, current_user)


@router.get("/api/grn", response_model=List[GrnWorkItem], dependencies=[Depends(require_grn_list)])
def list_store_work(
    status: Optional[GrnStatus] = None,
    erp_status: Optional[ErpStatus] = None,
    db: Session = Depends(get_db),
):
    return build_store_work_list(db, status, erp_status)


@router.get("/api/entries/{entry_id}/grn", response_model=GrnOut)
def get_grn(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _grn_response(db, entry_id, current_user)


@router.patch("/api/entries/{entry_id}/grn/lines", response_model=GrnOut)
def edit_grn_lines(
    entry_id: int,
    payload: GrnLinesEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_store),
):
    """Quantities are freely editable (B6); each change is audited and flags the line as edited."""
    entry = get_entry_or_404(db, entry_id, for_update=True)
    receipt = get_receipt_or_404(db, entry_id)
    edit_receipt_lines(db, entry, receipt, payload.lines, current_user)
    db.commit()
    return _grn_response(db, entry_id, current_user)


@router.post("/api/entries/{entry_id}/grn/approve", response_model=GrnOut)
def approve_grn(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_store)):
    """T6. Returns 200 whatever the ERP outcome; the approval itself is committed first (B13)."""
    entry = get_entry_or_404(db, entry_id, for_update=True)
    receipt = get_receipt_or_404(db, entry_id)
    approve_goods_receipt(db, entry, receipt, current_user)
    db.commit()
    if receipt.erp_status == ERP_PENDING:
        post_goods_receipt(db, entry, receipt, actor=current_user)
    return _grn_response(db, entry_id, current_user)


@router.post("/api/entries/{entry_id}/grn/retry-post", response_model=GrnOut)
def retry_grn_post(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_store)):
    """Re-send with the same idempotency key; allowed after gate-out too."""
    entry = get_entry_or_404(db, entry_id, for_update=True)
    receipt = get_receipt_or_404(db, entry_id)
    if receipt.status != GRN_STATUS_APPROVED or receipt.erp_status not in POSTABLE_ERP_STATUSES:
        raise HTTPException(status_code=409, detail=ERP_NOT_PENDING_DETAIL)
    post_goods_receipt(db, entry, receipt, actor=current_user)
    return _grn_response(db, entry_id, current_user)
