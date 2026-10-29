from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.auth import (
    GATE_IN_ROLES,
    GATE_OUT_ROLES,
    ROLE_NOT_ALLOWED_DETAIL,
    WEIGH_ROLES,
    get_current_user,
    require_roles,
)
from app.database import get_db
from app.models import GoodsReceipt, PassWeighment, User, VehicleEntry, VehicleEntryPhoto
from app.pass_creation import build_pass, find_by_client_ref
from app.pass_states import (
    OPEN_STATES,
    PASS_TYPE_INWARD,
    apply_transition,
    ensure_state_in,
    is_transition_allowed,
    raise_state_conflict,
)
from app.pass_views import to_detail_out, to_entry_out
from app.photo_storage import (
    GATE_IN_PHOTO_KINDS,
    PHOTO_KIND_VEHICLE,
    PHOTO_KIND_WEIGH_FRAME,
    PHOTO_KINDS,
    WEIGH_PHOTO_KINDS,
    InvalidPhotoError,
    delete_entry_photos,
    read_upload_capped,
    validate_photo,
    write_entry_photo,
)
from app.schemas import (
    CancelRequest,
    ExitRequest,
    PassDetailOut,
    PassState,
    PassType,
    PhotoOut,
    VehicleEntryCreate,
    VehicleEntryOut,
    WeighmentCreate,
    WeightUpdate,
)
from app.weighing import KIND_GROSS, SOURCE_MANUAL, capture_weighment, current_weighment

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(get_current_user)])

LIKE_ESCAPE_CHAR = "\\"
ENTRY_NOT_FOUND_DETAIL = "Entry not found"
CONFIRM_REJECTED_DETAIL = "Confirm the rejected material is on the vehicle"
UNKNOWN_PHOTO_KIND_DETAIL = "Unknown photo kind"
UNKNOWN_WEIGHMENT_DETAIL = "Weighment does not belong to this pass"
LEGACY_WEIGHT_REASON = "Entered on legacy screen"
INWARD_GATE_OUT_TRANSITION = "T7"
GENERAL_GATE_OUT_TRANSITION = "T8"
CANCEL_TRANSITION = "T9"

require_gate_in = require_roles(*GATE_IN_ROLES)
require_gate_out = require_roles(*GATE_OUT_ROLES)
require_weigh = require_roles(*WEIGH_ROLES)


def _to_naive_utc(value: datetime) -> datetime:
    # Columns store naive UTC; aware inputs (e.g. "...Z") must be shifted to UTC before comparing.
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _escape_like(value: str) -> str:
    return (
        value.replace(LIKE_ESCAPE_CHAR, LIKE_ESCAPE_CHAR * 2)
        .replace("%", f"{LIKE_ESCAPE_CHAR}%")
        .replace("_", f"{LIKE_ESCAPE_CHAR}_")
        # SQL Server treats [..] as a character class inside LIKE.
        .replace("[", f"{LIKE_ESCAPE_CHAR}[")
    )


def _get_entry_or_404(db: Session, entry_id: int, lock: bool = False) -> VehicleEntry:
    query = db.query(VehicleEntry).filter(VehicleEntry.id == entry_id)
    # Row lock so two captures / exits on the same pass cannot interleave.
    entry = query.with_for_update().first() if lock else query.first()
    if not entry:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND_DETAIL)
    return entry


@router.post("", response_model=VehicleEntryOut, status_code=201)
def create_entry(
    payload: VehicleEntryCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gate_in),
):
    existing = find_by_client_ref(db, payload.client_ref)
    if existing:
        # An offline replay of a pass that already reached the server.
        response.status_code = 200
        return to_entry_out(existing)
    entry = build_pass(db, payload, current_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = find_by_client_ref(db, payload.client_ref)
        if not existing:
            raise
        response.status_code = 200
        return to_entry_out(existing)
    db.refresh(entry)
    return to_entry_out(entry)


def _apply_list_filters(query, vehicle_number, date_from, date_to, weighed, pass_type, state, erp_status):
    if vehicle_number:
        pattern = f"%{_escape_like(vehicle_number)}%"
        query = query.filter(VehicleEntry.vehicle_number.ilike(pattern, escape=LIKE_ESCAPE_CHAR))
    if date_from:
        query = query.filter(VehicleEntry.entry_time >= _to_naive_utc(date_from))
    if date_to:
        query = query.filter(VehicleEntry.entry_time <= _to_naive_utc(date_to))
    if weighed is not None:
        has_weight = VehicleEntry.gross_weight.isnot(None)
        query = query.filter(has_weight if weighed else VehicleEntry.gross_weight.is_(None))
    if pass_type:
        query = query.filter(VehicleEntry.pass_type == pass_type)
    if state:
        query = query.filter(VehicleEntry.pass_state.in_(state))
    if erp_status:
        query = query.join(GoodsReceipt, GoodsReceipt.entry_id == VehicleEntry.id)
        query = query.filter(GoodsReceipt.erp_status == erp_status)
    return query


@router.get("", response_model=List[VehicleEntryOut])
def list_entries(
    vehicle_number: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    weighed: Optional[bool] = None,
    pass_type: Optional[PassType] = None,
    state: Optional[List[PassState]] = Query(default=None),
    erp_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = _apply_list_filters(
        db.query(VehicleEntry), vehicle_number, date_from, date_to, weighed, pass_type, state, erp_status
    )
    now = datetime.utcnow()
    return [to_entry_out(entry, now) for entry in query.order_by(VehicleEntry.entry_time.desc()).all()]


@router.get("/{entry_id}", response_model=PassDetailOut)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    return to_detail_out(db, _get_entry_or_404(db, entry_id))


def _rejected_total(entry: VehicleEntry) -> float:
    receipt = entry.goods_receipt
    return sum(float(line.rejected_qty) for line in receipt.lines) if receipt else 0.0


def _gate_out(db: Session, entry: VehicleEntry, payload: ExitRequest, user: User) -> None:
    if entry.pass_type != PASS_TYPE_INWARD:
        apply_transition(db, entry, GENERAL_GATE_OUT_TRANSITION, actor=user)
        return
    if not is_transition_allowed(entry, INWARD_GATE_OUT_TRANSITION):
        raise_state_conflict()
    has_rejected = _rejected_total(entry) > 0
    if has_rejected and not payload.rejected_material_on_vehicle:
        raise HTTPException(status_code=422, detail=CONFIRM_REJECTED_DETAIL)
    apply_transition(db, entry, INWARD_GATE_OUT_TRANSITION, actor=user)
    if has_rejected:
        record_audit(db, entry.id, "rejected_material_confirmed", field="return_pass_number",
                     new_value=entry.goods_receipt.return_pass_number, actor=user)


@router.patch("/{entry_id}/exit", response_model=VehicleEntryOut)
def mark_exit(
    entry_id: int,
    payload: Optional[ExitRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gate_out),
):
    entry = _get_entry_or_404(db, entry_id, lock=True)
    if entry.exit_time is not None:
        raise_state_conflict()
    _gate_out(db, entry, payload or ExitRequest(), current_user)
    entry.exit_time = datetime.utcnow()
    db.commit()
    db.refresh(entry)
    return to_entry_out(entry)


@router.post("/{entry_id}/cancel", response_model=VehicleEntryOut)
def cancel_entry(
    entry_id: int,
    payload: CancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gate_in),
):
    entry = _get_entry_or_404(db, entry_id, lock=True)
    apply_transition(db, entry, CANCEL_TRANSITION, actor=current_user)
    entry.cancelled_reason = payload.reason
    record_audit(db, entry.id, "pass_cancelled", field="cancelled_reason", new_value=payload.reason,
                 actor=current_user)
    db.commit()
    db.refresh(entry)
    return to_entry_out(entry)


@router.patch("/{entry_id}/weight", response_model=VehicleEntryOut)
def record_weight(
    entry_id: int,
    payload: WeightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_weigh),
):
    """Compatibility path for the old weighbridge screen: a manual gross weighment."""
    entry = _get_entry_or_404(db, entry_id, lock=True)
    has_gross = current_weighment(db, entry.id, KIND_GROSS) is not None
    weighment = WeighmentCreate(
        kind=KIND_GROSS, source=SOURCE_MANUAL, weight=payload.gross_weight, unit=payload.weight_unit,
        manual_reason=LEGACY_WEIGHT_REASON, supersede_reason=LEGACY_WEIGHT_REASON if has_gross else None,
    )
    capture_weighment(db, entry, weighment, current_user)
    db.commit()
    db.refresh(entry)
    return to_entry_out(entry)


def _resolve_photo_kind(kind: Optional[str], user: User) -> str:
    if kind is None:
        # Older screens send no kind: weighbridge staff upload weigh frames, the gate uploads vehicle photos.
        return PHOTO_KIND_WEIGH_FRAME if user.role in WEIGH_ROLES and user.role not in GATE_IN_ROLES else PHOTO_KIND_VEHICLE
    if kind not in PHOTO_KINDS:
        raise HTTPException(status_code=422, detail=UNKNOWN_PHOTO_KIND_DETAIL)
    return kind


def _check_photo_permission(kind: str, user: User) -> None:
    allowed = (kind in GATE_IN_PHOTO_KINDS and user.role in GATE_IN_ROLES) or (
        kind in WEIGH_PHOTO_KINDS and user.role in WEIGH_ROLES
    )
    if not allowed:
        raise HTTPException(status_code=403, detail=ROLE_NOT_ALLOWED_DETAIL)


def _check_weighment_link(db: Session, entry_id: int, weighment_id: Optional[int]) -> None:
    if weighment_id is None:
        return
    row = db.get(PassWeighment, weighment_id)
    if row is None or row.entry_id != entry_id:
        raise HTTPException(status_code=422, detail=UNKNOWN_WEIGHMENT_DETAIL)


async def _read_and_validate_uploads(files: List[UploadFile]) -> List[Tuple[bytes, str]]:
    # Every file is checked before any is written, so one bad file cannot leave orphans on disk.
    validated = []
    for upload_file in files:
        try:
            contents = await read_upload_capped(upload_file)
            extension = validate_photo(upload_file.content_type, contents)
        except InvalidPhotoError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        validated.append((contents, extension))
    return validated


def _store_photos(db, entry_id, uploads, kind, weighment_id, user) -> List[VehicleEntryPhoto]:
    written_paths, created_photos = [], []
    try:
        for contents, extension in uploads:
            file_path = write_entry_photo(entry_id, contents, extension)
            written_paths.append(file_path)
            photo = VehicleEntryPhoto(entry_id=entry_id, file_path=file_path, uploaded_by_id=user.id,
                                      kind=kind, weighment_id=weighment_id)
            db.add(photo)
            created_photos.append(photo)
        record_audit(db, entry_id, "photo_uploaded", field="kind", new_value=f"{kind} x{len(uploads)}", actor=user)
        db.commit()
    except Exception:
        db.rollback()
        delete_entry_photos(written_paths)
        raise
    return created_photos


@router.post("/{entry_id}/photos", response_model=List[PhotoOut], status_code=201)
async def upload_photos(
    entry_id: int,
    files: List[UploadFile] = File(...),
    kind: Optional[str] = Form(default=None),
    weighment_id: Optional[int] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo_kind = _resolve_photo_kind(kind, current_user)
    _check_photo_permission(photo_kind, current_user)
    entry = _get_entry_or_404(db, entry_id)
    ensure_state_in(entry, OPEN_STATES)
    _check_weighment_link(db, entry_id, weighment_id)

    validated_uploads = await _read_and_validate_uploads(files)
    created_photos = _store_photos(db, entry_id, validated_uploads, photo_kind, weighment_id, current_user)
    for photo in created_photos:
        db.refresh(photo)
    return created_photos
