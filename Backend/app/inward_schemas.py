"""Request and response schemas for quality, GRN, dashboard and the quality service payload."""

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas import ChallanLineOut, OptionalText, UtcDatetime

# Mirrors NUMERIC(12, 3) on quantity columns (spec 6.3); all quantities are >= 0.
QUANTITY_MAX_DIGITS = 12
QUANTITY_DECIMAL_PLACES = 3
MAX_CHALLAN_LINES = 20
MAX_LINE_REMARKS_LENGTH = 200
MAX_RESULT_REMARKS_LENGTH = 500
MAX_INSPECTOR_NAME_LENGTH = 100
MAX_MATERIAL_LENGTH = 200

Quantity = Annotated[
    Decimal,
    Field(ge=0, max_digits=QUANTITY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES),
]
QualityResultValue = Literal["approved", "rejected", "partial"]
GrnStatus = Literal["draft", "approved"]
ErpStatus = Literal["not_required", "pending", "posted", "failed"]
Tone = Literal["good", "warn", "crit", "info", "neutral"]


# ---- Quality (in-app) ----

class QualityLineIn(BaseModel):
    challan_line_id: Annotated[int, Field(gt=0)]
    accepted_qty: Quantity
    rejected_qty: Quantity
    remarks: OptionalText(MAX_LINE_REMARKS_LENGTH) = None


class QualityResultIn(BaseModel):
    lines: Annotated[List[QualityLineIn], Field(min_length=1, max_length=MAX_CHALLAN_LINES)]
    remarks: OptionalText(MAX_RESULT_REMARKS_LENGTH) = None


class QualityResultLineOut(BaseModel):
    challan_line_id: int
    accepted_qty: float
    rejected_qty: float
    remarks: Optional[str] = None


class QualityResultOut(BaseModel):
    id: int
    entry_id: int
    result: QualityResultValue
    source: str
    inspected_by_name: Optional[str] = None
    inspected_at: Optional[UtcDatetime] = None
    recorded_at: UtcDatetime
    remarks: Optional[str] = None
    lines: List[QualityResultLineOut]


class QualityResultSaved(BaseModel):
    pass_state: str
    quality_result: QualityResultOut


class QualityQueueItem(BaseModel):
    id: int
    vehicle_number: str
    supplier: Optional[str] = None
    po_number: Optional[str] = None
    challan_number: Optional[str] = None
    pass_state: str
    pass_state_changed_at: Optional[UtcDatetime] = None
    minutes_in_state: Optional[int] = None
    over_sla: bool
    challan_lines: List[ChallanLineOut]
    current_result: Optional[QualityResultOut] = None


# ---- Quality service (external app) ----

class ServiceInspectionLine(BaseModel):
    # The external app's payload may carry fields we do not use; ignore rather than reject them.
    model_config = ConfigDict(extra="ignore")

    line_no: Optional[Annotated[int, Field(ge=1)]] = None
    material: OptionalText(MAX_MATERIAL_LENGTH) = None
    accepted_qty: Quantity
    rejected_qty: Quantity
    remarks: OptionalText(MAX_LINE_REMARKS_LENGTH) = None


class ServiceInspectionResult(BaseModel):
    """`Quality.InspectionApproved v1`; the wire name is kept although it also carries rejections."""

    model_config = ConfigDict(extra="ignore")

    pass_id: Annotated[int, Field(gt=0)]
    result: QualityResultValue
    inspected_by: OptionalText(MAX_INSPECTOR_NAME_LENGTH) = None
    inspected_at: Optional[UtcDatetime] = None
    remarks: OptionalText(MAX_RESULT_REMARKS_LENGTH) = None
    lines: Annotated[List[ServiceInspectionLine], Field(min_length=1, max_length=MAX_CHALLAN_LINES)]


class ServiceInspectionAck(BaseModel):
    pass_id: int
    pass_state: str
    result: QualityResultValue
    replayed: bool


class PendingInspectionLine(BaseModel):
    line_no: int
    material: str
    qty: float
    uom: str


class PendingInspection(BaseModel):
    pass_id: int
    po_no: Optional[str] = None
    supplier: Optional[str] = None
    vehicle_no: str
    challan_no: Optional[str] = None
    lines: List[PendingInspectionLine]
    sent_at: Optional[UtcDatetime] = None


# ---- GRN ----

class GrnLineEdit(BaseModel):
    id: Annotated[int, Field(gt=0)]
    received_qty: Optional[Quantity] = None
    accepted_qty: Optional[Quantity] = None
    rejected_qty: Optional[Quantity] = None
    # Sending remarks as "" or null clears them; leaving the key out keeps them.
    remarks: OptionalText(MAX_LINE_REMARKS_LENGTH) = None


class GrnLinesEdit(BaseModel):
    lines: Annotated[List[GrnLineEdit], Field(min_length=1, max_length=MAX_CHALLAN_LINES)]


class GrnLineOut(BaseModel):
    id: int
    line_no: int
    challan_line_id: Optional[int] = None
    material: str
    uom: str
    po_qty: Optional[float] = None
    challan_qty: float
    received_qty: float
    accepted_qty: float
    rejected_qty: float
    quality_accepted_qty: Optional[float] = None
    qty_edited: bool
    remarks: Optional[str] = None
    # Informational only (rule B7); never blocks saving or approval.
    flags: List[str]


class PersonOut(BaseModel):
    id: int
    full_name: str


class GrnOut(BaseModel):
    id: int
    entry_id: int
    pass_state: str
    status: GrnStatus
    created_by_id: int
    created_at: UtcDatetime
    approved_by: Optional[PersonOut] = None
    approved_at: Optional[UtcDatetime] = None
    erp_status: Optional[ErpStatus] = None
    erp_grn_number: Optional[str] = None
    erp_attempts: int
    erp_last_error: Optional[str] = None
    erp_last_attempt_at: Optional[UtcDatetime] = None
    return_pass_number: Optional[str] = None
    total_received_qty: float
    total_accepted_qty: float
    total_rejected_qty: float
    quality_result: Optional[QualityResultValue] = None
    inspected_by_name: Optional[str] = None
    # Users who captured a gross or tare weighment; none of them may approve (rule B9).
    weighed_by: List[PersonOut]
    current_user_weighed: bool
    lines: List[GrnLineOut]


class GrnWorkItem(BaseModel):
    entry_id: int
    group: Literal["send_for_inspection", "ready_for_grn", "draft", "pending_post", "approved"]
    vehicle_number: str
    supplier: Optional[str] = None
    po_number: Optional[str] = None
    challan_number: Optional[str] = None
    pass_state: str
    minutes_in_state: Optional[int] = None
    grn_id: Optional[int] = None
    grn_status: Optional[GrnStatus] = None
    erp_status: Optional[ErpStatus] = None
    erp_attempts: Optional[int] = None
    erp_last_error: Optional[str] = None
    return_pass_number: Optional[str] = None


# ---- Dashboard ----

class DashboardKpis(BaseModel):
    on_site_now: int
    awaiting_quality: int
    quality_over_sla: int
    grn_pending_post: int
    # None when no pass exited on the day; the screen shows a dash.
    avg_dwell_minutes: Optional[int] = None
    vehicles_today: int


class DashboardRow(BaseModel):
    id: int
    vehicle_number: str
    supplier: Optional[str] = None
    pass_type: str
    pass_state: str
    display_state: str
    tone: Tone
    # ERP post status of the pass's GRN; None when no GRN exists yet.
    erp_status: Optional[ErpStatus] = None
    dwell_minutes: int
    minutes_in_state: Optional[int] = None
    over_sla: bool
    # "challan" for inward passes; None for general passes (shown as a dash).
    qty_source: Optional[str] = None


class DashboardSummary(BaseModel):
    day: date
    generated_at: UtcDatetime
    dwell_sla_minutes: int
    quality_sla_minutes: int
    kpis: DashboardKpis
    board: List[DashboardRow]
