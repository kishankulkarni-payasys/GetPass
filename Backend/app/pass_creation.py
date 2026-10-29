"""Creating a pass at the gate: inward validation, server-side PO cross-check, OCR override audit."""

import json
from datetime import datetime
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.integrations import AdapterError, log_adapter_failure
from app.integrations.ocr import normalize_plate
from app.integrations.po_lookup import get_po_lookup_adapter
from app.models import PassChallanLine, User, VehicleEntry
from app.pass_states import PASS_TYPE_INWARD
from app.schemas import VehicleEntryCreate

PO_MATCHED = "matched"
PO_NOT_FOUND = "not_found"
PO_NOT_CHECKED = "not_checked"
INWARD_FIELDS_REQUIRED_DETAIL = "PO number, challan number and at least one challan line are required"
MAX_MATERIAL_DESCRIPTION_LENGTH = 200
MAX_SUPPLIER_LENGTH = 100
# Never copied into audit rows (spec 6.2: no driver phone in audit values).
SENSITIVE_OVERRIDE_FIELDS = frozenset({"driver_phone"})
V2_ONLY_FIELDS = {"pass_type", "client_ref", "gate_in_method", "po_number", "challan_number", "challan_lines", "ocr"}


def find_by_client_ref(db: Session, client_ref: Optional[str]) -> Optional[VehicleEntry]:
    if not client_ref:
        return None
    return db.query(VehicleEntry).filter(VehicleEntry.client_ref == client_ref).first()


def lookup_po(po_number: str) -> Tuple[str, Optional[dict]]:
    """Cross-check the PO; adapter problems give `not_checked` and never block the gate."""
    adapter = get_po_lookup_adapter()
    if not adapter.enabled:
        return PO_NOT_CHECKED, None
    try:
        po = adapter.get_po(po_number)
    except AdapterError as exc:
        log_adapter_failure("po_lookup", exc)
        return PO_NOT_CHECKED, None
    return (PO_MATCHED, po) if po else (PO_NOT_FOUND, None)


def _validate_inward(payload: VehicleEntryCreate) -> None:
    if not (payload.po_number and payload.challan_number and payload.challan_lines):
        raise HTTPException(status_code=422, detail=INWARD_FIELDS_REQUIRED_DETAIL)


def _apply_inward_fields(entry: VehicleEntry, payload: VehicleEntryCreate) -> None:
    status, po = lookup_po(payload.po_number)
    entry.po_lookup_status = status
    entry.po_lookup_snapshot = json.dumps(po) if po else None
    # Old list columns keep reading sensibly for inward passes.
    entry.reference_doc_number = payload.po_number
    entry.material_description = payload.challan_lines[0].material[:MAX_MATERIAL_DESCRIPTION_LENGTH]
    if not entry.supplier_transporter_name and po and po.get("supplier_name"):
        entry.supplier_transporter_name = str(po["supplier_name"])[:MAX_SUPPLIER_LENGTH]
    entry.challan_lines = [
        PassChallanLine(line_no=index, material=line.material, quantity=line.quantity,
                        uom=line.uom, ocr_confidence=line.ocr_confidence)
        for index, line in enumerate(payload.challan_lines, start=1)
    ]


def _apply_ocr_meta(entry: VehicleEntry, payload: VehicleEntryCreate) -> None:
    if payload.ocr is None:
        return
    entry.anpr_confidence = payload.ocr.anpr_confidence
    entry.po_ocr_confidence = payload.ocr.po_confidence
    entry.challan_ocr_confidence = payload.ocr.challan_confidence
    entry.manual_override = bool(payload.ocr.overridden_fields)


def _audit_creation(db: Session, entry: VehicleEntry, payload: VehicleEntryCreate, user: User) -> None:
    record_audit(db, entry.id, "pass_created", field="pass_type", new_value=entry.pass_type, actor=user)
    for override in payload.ocr.overridden_fields if payload.ocr else []:
        hide = override.field in SENSITIVE_OVERRIDE_FIELDS
        record_audit(
            db, entry.id, "ocr_field_overridden", field=override.field,
            old_value=None if hide else override.ocr_value,
            new_value=None if hide else override.final_value,
            is_manual_override=True, actor=user,
        )


def build_pass(db: Session, payload: VehicleEntryCreate, user: User) -> VehicleEntry:
    """Add a new pass and its audit rows to the session; the caller commits."""
    is_inward = payload.pass_type == PASS_TYPE_INWARD
    if is_inward:
        _validate_inward(payload)
    entry = VehicleEntry(
        **payload.model_dump(exclude=V2_ONLY_FIELDS),
        pass_type=payload.pass_type,
        client_ref=payload.client_ref,
        gate_in_method=payload.gate_in_method,
        po_number=payload.po_number if is_inward else None,
        challan_number=payload.challan_number if is_inward else None,
        created_by_id=user.id,
        pass_state_changed_at=datetime.utcnow(),
    )
    entry.vehicle_number = normalize_plate(entry.vehicle_number)
    if is_inward:
        _apply_inward_fields(entry, payload)
    _apply_ocr_meta(entry, payload)
    db.add(entry)
    db.flush()
    _audit_creation(db, entry, payload, user)
    return entry
