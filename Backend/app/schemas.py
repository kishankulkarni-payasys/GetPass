from datetime import datetime, timezone
from typing import Annotated, List, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer, StringConstraints

# Mirrors Numeric(10, 2) on the quantity/weight columns.
MAX_NUMERIC_10_2 = 99_999_999.99
# Mirrors Numeric(12, 3) on the challan / GRN quantity columns.
MAX_NUMERIC_12_3 = 999_999_999.999
MAX_CONFIDENCE = 100
MAX_CHALLAN_LINES = 20
# Bounds the audit rows one request can create.
MAX_OCR_OVERRIDES = 30
MIN_REASON_LENGTH = 3
MAX_REASON_LENGTH = 200
MIN_CANCEL_REASON_LENGTH = 5
# Smallest weight that survives rounding to two decimals.
MIN_WEIGHT = 0.01
MIN_PASSWORD_LENGTH = 8
# bcrypt only uses the first 72 bytes and newer versions reject longer input.
MAX_PASSWORD_BYTES = 72


def _to_utc_iso(value: datetime) -> str:
    # The database stores naive UTC; without an explicit "Z" browsers read the
    # value as local time and show it 5h30m early in India.
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _check_password_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return value


UtcDatetime = Annotated[datetime, PlainSerializer(_to_utc_iso, return_type=str, when_used="json")]


def RequiredText(max_length: int, min_length: int = 1):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)]


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    return value or None


def OptionalText(max_length: int):
    # The form sends "" for untouched fields; store those as NULL like omitted ones.
    return Annotated[
        Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)]],
        AfterValidator(_blank_to_none),
    ]


Password = Annotated[
    str,
    StringConstraints(min_length=MIN_PASSWORD_LENGTH),
    AfterValidator(_check_password_bytes),
]
WeightUnit = Literal["kg", "ton"]
GateInMethod = Literal["ocr", "qr", "manual"]
WeighmentKind = Literal["gross", "tare"]
WeighmentSource = Literal["indicator", "manual"]
Confidence = Annotated[float, Field(ge=0, le=MAX_CONFIDENCE)]
PassType = Literal["inward", "general"]
PassState = Literal[
    "GATE_IN", "ON_SITE", "QUALITY_PENDING", "QUALITY_RESOLVED", "GRN_DRAFT", "GRN_APPROVED", "GATE_OUT", "CANCELLED"
]


class ChallanLineIn(BaseModel):
    material: RequiredText(200)
    quantity: Annotated[float, Field(ge=0, le=MAX_NUMERIC_12_3)]
    uom: RequiredText(20)
    ocr_confidence: Optional[Confidence] = None


class OcrOverride(BaseModel):
    field: RequiredText(50)
    ocr_value: OptionalText(500) = None
    final_value: OptionalText(500) = None
    confidence: Optional[Confidence] = None


class OcrCapture(BaseModel):
    anpr_confidence: Optional[Confidence] = None
    po_confidence: Optional[Confidence] = None
    challan_confidence: Optional[Confidence] = None
    overridden_fields: List[OcrOverride] = Field(default_factory=list, max_length=MAX_OCR_OVERRIDES)


class VehicleEntryCreate(BaseModel):
    vehicle_number: RequiredText(20)
    project_name: OptionalText(100) = None
    subproject_name: OptionalText(100) = None
    driver_name: RequiredText(100)
    driver_phone: OptionalText(20) = None
    material_description: OptionalText(200) = None
    material_quantity: Optional[Annotated[float, Field(ge=0, le=MAX_NUMERIC_10_2)]] = None
    material_unit: OptionalText(20) = None
    purpose: OptionalText(50) = None
    reference_doc_number: OptionalText(50) = None
    supplier_transporter_name: OptionalText(100) = None
    # v2 fields; all optional so the existing gate-in screen keeps working as a general pass.
    pass_type: PassType = "general"
    client_ref: OptionalText(36) = None
    gate_in_method: GateInMethod = "manual"
    po_number: OptionalText(50) = None
    challan_number: OptionalText(50) = None
    challan_lines: List[ChallanLineIn] = Field(default_factory=list, max_length=MAX_CHALLAN_LINES)
    ocr: Optional[OcrCapture] = None


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str
    uploaded_at: UtcDatetime
    kind: str = "vehicle"


class VehicleEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    project_name: Optional[str] = None
    subproject_name: Optional[str] = None
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None
    entry_time: UtcDatetime
    exit_time: Optional[UtcDatetime] = None
    gross_weight: Optional[float] = None
    weight_unit: Optional[str] = None
    weighed_at: Optional[UtcDatetime] = None
    weighed_by_id: Optional[int] = None
    photos: List[PhotoOut] = []
    created_at: UtcDatetime
    pass_type: PassType = "general"
    pass_state: PassState = "GATE_IN"
    pass_state_changed_at: Optional[UtcDatetime] = None
    gate_in_method: Optional[str] = None
    po_number: Optional[str] = None
    challan_number: Optional[str] = None
    po_lookup_status: Optional[str] = None
    manual_override: bool = False
    cancelled_reason: Optional[str] = None
    # Computed by the API (pass_views), not stored.
    display_state: Optional[str] = None
    dwell_minutes: Optional[int] = None
    erp_status: Optional[str] = None


class WeightUpdate(BaseModel):
    gross_weight: Annotated[float, Field(ge=MIN_WEIGHT, le=MAX_NUMERIC_10_2)]
    weight_unit: Optional[WeightUnit] = None


class WeighmentCreate(BaseModel):
    kind: WeighmentKind
    source: WeighmentSource
    weight: Optional[Annotated[float, Field(ge=MIN_WEIGHT, le=MAX_NUMERIC_10_2)]] = None
    unit: Optional[WeightUnit] = None
    manual_reason: OptionalText(MAX_REASON_LENGTH) = None
    supersede_reason: OptionalText(MAX_REASON_LENGTH) = None


class WeighmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    weight: float
    unit: str
    source: str
    indicator_frame_ref: Optional[str] = None
    stable: Optional[bool] = None
    manual_reason: Optional[str] = None
    supersedes_id: Optional[int] = None
    captured_by_id: Optional[int] = None
    captured_at: UtcDatetime
    is_superseded: bool = False


class IndicatorReadingOut(BaseModel):
    available: bool
    weight_kg: Optional[float] = None
    stable: Optional[bool] = None
    frame_ref: Optional[str] = None
    read_at: Optional[UtcDatetime] = None


class ExitRequest(BaseModel):
    rejected_material_on_vehicle: bool = False


class CancelRequest(BaseModel):
    reason: RequiredText(MAX_REASON_LENGTH, min_length=MIN_CANCEL_REASON_LENGTH)


class ChallanLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    line_no: int
    material: str
    quantity: float
    uom: str
    ocr_confidence: Optional[float] = None


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    is_manual_override: bool
    actor_user_id: Optional[int] = None
    actor_name: Optional[str] = None
    actor_service: Optional[str] = None
    created_at: UtcDatetime


class QualityLineSummary(BaseModel):
    challan_line_id: int
    accepted_qty: float
    rejected_qty: float
    remarks: Optional[str] = None


class QualitySummary(BaseModel):
    result: str
    source: str
    inspected_by_name: Optional[str] = None
    inspected_at: Optional[UtcDatetime] = None
    remarks: Optional[str] = None
    lines: List[QualityLineSummary] = []


class GrnSummary(BaseModel):
    status: str
    erp_status: Optional[str] = None
    erp_grn_number: Optional[str] = None
    return_pass_number: Optional[str] = None
    total_rejected_qty: float = 0
    approved_at: Optional[UtcDatetime] = None


class PassDetailOut(VehicleEntryOut):
    challan_lines: List[ChallanLineOut] = []
    weighments: List[WeighmentOut] = []
    current_gross_kg: Optional[float] = None
    current_tare_kg: Optional[float] = None
    net_kg: Optional[float] = None
    quality: Optional[QualitySummary] = None
    grn: Optional[GrnSummary] = None
    audit: List[AuditOut] = []


class GateInConfigOut(BaseModel):
    ocr_enabled: bool
    po_lookup_enabled: bool
    ocr_confidence_threshold: float
    max_challan_lines: int


class OcrLineOut(BaseModel):
    material: str
    quantity: Optional[float] = None
    uom: Optional[str] = None
    confidence: Optional[float] = None


class OcrResultOut(BaseModel):
    doc_type: str
    confidence: Optional[float] = None
    plate: Optional[str] = None
    po_number: Optional[str] = None
    supplier_name: Optional[str] = None
    challan_number: Optional[str] = None
    lines: List[OcrLineOut] = []
    field_confidence: dict = {}


class PoLineOut(BaseModel):
    material: str
    uom: Optional[str] = None
    open_qty: Optional[float] = None


class PoOut(BaseModel):
    po_number: str
    supplier_name: Optional[str] = None
    lines: List[PoLineOut] = []


class PoLookupOut(BaseModel):
    status: Literal["matched", "not_found", "not_checked"]
    po: Optional[PoOut] = None


class PoSearchHit(BaseModel):
    po_number: str
    supplier_name: Optional[str] = None
    open_lines: int = 0


Role = Literal[
    "admin",
    "security_guard",
    "weighbridge_operator",
    "store_incharge",
    "quality_inspector",
    "site_supervisor",
]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: RequiredText(50, min_length=3)
    password: Password
    full_name: RequiredText(100)
    role: Role


class UserUpdate(BaseModel):
    full_name: Optional[RequiredText(100)] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[Password] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: UtcDatetime
