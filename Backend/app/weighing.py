"""Weighment capture rules: insert-only rows, supersede with a reason, gross moves inward GATE_IN → ON_SITE."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Set

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.integrations import AdapterError, log_adapter_failure
from app.integrations.weighbridge_indicator import get_indicator_adapter
from app.models import PassWeighment, User, VehicleEntry
from app.pass_states import (
    GATE_IN,
    GROSS_RECAPTURE_STATES,
    INWARD_TARE_STATES,
    OPEN_STATES,
    PASS_TYPE_INWARD,
    apply_transition,
    ensure_state_in,
)
from app.schemas import MIN_REASON_LENGTH, WeighmentCreate

KIND_GROSS = "gross"
KIND_TARE = "tare"
SOURCE_INDICATOR = "indicator"
SOURCE_MANUAL = "manual"
UNIT_KG = "kg"
UNIT_TON = "ton"
KG_PER_TON = 1000
GROSS_TRANSITION = "T2"

REASON_REQUIRED_DETAIL = "A reason is required"
NOT_STABLE_DETAIL = "Weighbridge reading is not stable"
INDICATOR_FAILED_DETAIL = "Weighbridge indicator did not respond"
INDICATOR_OFF_DETAIL = "Weighbridge indicator is not configured"
TARE_ABOVE_GROSS_DETAIL = "Tare weight cannot be more than gross weight"
WEIGHT_REQUIRED_DETAIL = "Weight is required for manual entry"


@dataclass
class Reading:
    weight: float
    unit: str
    source: str
    frame_ref: Optional[str] = None
    raw_frame: Optional[str] = None
    stable: Optional[bool] = None
    manual_reason: Optional[str] = None


def to_kg(weight: Optional[float], unit: Optional[str]) -> Optional[float]:
    if weight is None:
        return None
    return float(weight) * KG_PER_TON if unit == UNIT_TON else float(weight)


def current_weighment(db: Session, entry_id: int, kind: str) -> Optional[PassWeighment]:
    """The latest row of a kind; a correction is always newer than what it supersedes."""
    return (
        db.query(PassWeighment)
        .filter(PassWeighment.entry_id == entry_id, PassWeighment.kind == kind)
        .order_by(PassWeighment.captured_at.desc(), PassWeighment.id.desc())
        .first()
    )


def superseded_ids(db: Session, entry_id: int) -> Set[int]:
    rows = (
        db.query(PassWeighment.supersedes_id)
        .filter(PassWeighment.entry_id == entry_id, PassWeighment.supersedes_id.isnot(None))
        .all()
    )
    return {row[0] for row in rows}


def _check_capture_state(entry: VehicleEntry, kind: str, has_existing: bool) -> None:
    ensure_state_in(entry, OPEN_STATES)
    if entry.pass_type != PASS_TYPE_INWARD:
        return
    if kind == KIND_TARE:
        ensure_state_in(entry, INWARD_TARE_STATES)
    elif has_existing:
        ensure_state_in(entry, GROSS_RECAPTURE_STATES)
    else:
        ensure_state_in(entry, frozenset({GATE_IN}))


def _read_indicator() -> Reading:
    adapter = get_indicator_adapter()
    if not adapter.available:
        raise HTTPException(status_code=503, detail=INDICATOR_OFF_DETAIL)
    try:
        data = adapter.read()
    except AdapterError as exc:
        log_adapter_failure("weighbridge", exc)
        raise HTTPException(status_code=502, detail=INDICATOR_FAILED_DETAIL)
    if not data["stable"]:
        raise HTTPException(status_code=409, detail=NOT_STABLE_DETAIL)
    return Reading(
        weight=data["weight_kg"], unit=UNIT_KG, source=SOURCE_INDICATOR,
        frame_ref=data.get("frame_ref"), raw_frame=data.get("raw_frame"), stable=True,
    )


def _resolve_reading(payload: WeighmentCreate) -> Reading:
    if payload.source == SOURCE_INDICATOR:
        return _read_indicator()
    if payload.weight is None:
        raise HTTPException(status_code=422, detail=WEIGHT_REQUIRED_DETAIL)
    if not payload.manual_reason or len(payload.manual_reason) < MIN_REASON_LENGTH:
        raise HTTPException(status_code=422, detail=REASON_REQUIRED_DETAIL)
    return Reading(
        weight=payload.weight, unit=payload.unit or UNIT_KG, source=SOURCE_MANUAL,
        manual_reason=payload.manual_reason,
    )


def _check_tare_not_above_gross(db: Session, entry: VehicleEntry, kind: str, reading: Reading) -> None:
    other_kind = KIND_GROSS if kind == KIND_TARE else KIND_TARE
    other = current_weighment(db, entry.id, other_kind)
    if other is None:
        return
    new_kg = to_kg(reading.weight, reading.unit)
    other_kg = to_kg(other.weight, other.unit)
    tare_kg, gross_kg = (new_kg, other_kg) if kind == KIND_TARE else (other_kg, new_kg)
    if tare_kg > gross_kg:
        raise HTTPException(status_code=422, detail=TARE_ABOVE_GROSS_DETAIL)


def _copy_gross_to_entry(entry: VehicleEntry, row: PassWeighment) -> None:
    # The old list screens read these columns; they mirror the current gross weighment.
    entry.gross_weight = row.weight
    entry.weight_unit = row.unit
    entry.weighed_at = row.captured_at
    entry.weighed_by_id = row.captured_by_id


def _audit_capture(db: Session, entry: VehicleEntry, row: PassWeighment, old: Optional[PassWeighment],
                   reason: Optional[str], user: User) -> None:
    manual = row.source == SOURCE_MANUAL
    record_audit(db, entry.id, "weighment_captured", field=row.kind,
                 new_value=f"{row.weight} {row.unit} ({row.source})", is_manual_override=manual, actor=user)
    if old is not None:
        record_audit(db, entry.id, "weighment_superseded", field=row.kind,
                     old_value=f"{old.weight} {old.unit}", new_value=f"{row.weight} {row.unit}: {reason}",
                     is_manual_override=manual, actor=user)


def capture_weighment(db: Session, entry: VehicleEntry, payload: WeighmentCreate, user: User) -> PassWeighment:
    """Validate and add a weighment (and any state change) to the session; the caller commits."""
    existing = current_weighment(db, entry.id, payload.kind)
    _check_capture_state(entry, payload.kind, existing is not None)
    # A recapture must say why, with the same minimum length as a manual-entry reason.
    if existing is not None and len(payload.supersede_reason or "") < MIN_REASON_LENGTH:
        raise HTTPException(status_code=422, detail=REASON_REQUIRED_DETAIL)
    reading = _resolve_reading(payload)
    _check_tare_not_above_gross(db, entry, payload.kind, reading)

    row = PassWeighment(
        entry_id=entry.id, kind=payload.kind, weight=reading.weight, unit=reading.unit,
        source=reading.source, indicator_frame_ref=reading.frame_ref, raw_frame=reading.raw_frame,
        stable=reading.stable, manual_reason=reading.manual_reason,
        supersedes_id=existing.id if existing else None,
        captured_by_id=user.id, captured_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    _audit_capture(db, entry, row, existing, payload.supersede_reason, user)
    if payload.kind == KIND_GROSS:
        _copy_gross_to_entry(entry, row)
        if entry.pass_type == PASS_TYPE_INWARD and entry.pass_state == GATE_IN:
            apply_transition(db, entry, GROSS_TRANSITION, actor=user)
    return row
