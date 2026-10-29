from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UnicodeText,
    Unicode,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base

# Every timestamp is naive UTC set in Python; the API adds the "Z" when it sends them.

PASS_TYPE_GENERAL = "general"
PASS_STATE_GATE_IN = "GATE_IN"
PHOTO_KIND_VEHICLE = "vehicle"
QUANTITY_PRECISION = Numeric(12, 3)
WEIGHT_PRECISION = Numeric(10, 2)
CONFIDENCE_PRECISION = Numeric(5, 2)


class VehicleEntry(Base):
    __tablename__ = "vehicle_entries"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(20), nullable=False, index=True)
    project_name = Column(String(100), nullable=True)
    subproject_name = Column(String(100), nullable=True)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(20), nullable=True)
    material_description = Column(String(200), nullable=True)
    material_quantity = Column(Numeric(10, 2), nullable=True)
    material_unit = Column(String(20), nullable=True)
    purpose = Column(String(50), nullable=True)
    reference_doc_number = Column(String(50), nullable=True)
    supplier_transporter_name = Column(String(100), nullable=True)
    entry_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    # Copy of the current gross weighment, kept so the existing list screens keep working.
    gross_weight = Column(WEIGHT_PRECISION, nullable=True)
    weight_unit = Column(String(20), nullable=True, default="kg")
    weighed_at = Column(DateTime, nullable=True)
    weighed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    pass_type = Column(String(10), nullable=False, default=PASS_TYPE_GENERAL, server_default=text("'general'"))
    pass_state = Column(String(20), nullable=False, default=PASS_STATE_GATE_IN, server_default=text("'GATE_IN'"), index=True)
    pass_state_changed_at = Column(DateTime, nullable=True)
    # Unique only where set; the filtered index is created by the migration script.
    client_ref = Column(String(36), nullable=True)
    gate_in_method = Column(String(10), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    po_number = Column(String(50), nullable=True, index=True)
    challan_number = Column(String(50), nullable=True)
    po_lookup_status = Column(String(15), nullable=True)
    po_lookup_snapshot = Column(UnicodeText, nullable=True)
    anpr_confidence = Column(CONFIDENCE_PRECISION, nullable=True)
    po_ocr_confidence = Column(CONFIDENCE_PRECISION, nullable=True)
    challan_ocr_confidence = Column(CONFIDENCE_PRECISION, nullable=True)
    manual_override = Column(Boolean, nullable=False, default=False, server_default=false())
    cancelled_reason = Column(Unicode(200), nullable=True)

    photos = relationship(
        "VehicleEntryPhoto",
        order_by="VehicleEntryPhoto.uploaded_at",
        cascade="all, delete-orphan",
    )
    challan_lines = relationship(
        "PassChallanLine",
        order_by="PassChallanLine.line_no",
        cascade="all, delete-orphan",
    )
    weighments = relationship(
        "PassWeighment",
        order_by="(PassWeighment.captured_at.desc(), PassWeighment.id.desc())",
        foreign_keys="PassWeighment.entry_id",
        viewonly=True,
    )
    goods_receipt = relationship("GoodsReceipt", uselist=False, viewonly=True)
    quality_results = relationship("QualityResult", viewonly=True)


class VehicleEntryPhoto(Base):
    __tablename__ = "vehicle_entry_photos"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    file_path = Column(String(255), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    kind = Column(String(15), nullable=False, default=PHOTO_KIND_VEHICLE, server_default=text("'vehicle'"))
    weighment_id = Column(Integer, ForeignKey("pass_weighments.id"), nullable=True)


class PassChallanLine(Base):
    __tablename__ = "pass_challan_lines"
    __table_args__ = (UniqueConstraint("entry_id", "line_no", name="uq_pass_challan_lines_entry_line"),)

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    line_no = Column(Integer, nullable=False)
    material = Column(Unicode(200), nullable=False)
    quantity = Column(QUANTITY_PRECISION, nullable=False)
    uom = Column(String(20), nullable=False)
    ocr_confidence = Column(CONFIDENCE_PRECISION, nullable=True)


class PassWeighment(Base):
    """Insert-only: a correction adds a new row that supersedes the old one."""

    __tablename__ = "pass_weighments"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    kind = Column(String(5), nullable=False)
    weight = Column(WEIGHT_PRECISION, nullable=False)
    unit = Column(String(5), nullable=False)
    source = Column(String(10), nullable=False)
    indicator_frame_ref = Column(String(100), nullable=True)
    raw_frame = Column(Unicode(2000), nullable=True)
    stable = Column(Boolean, nullable=True)
    manual_reason = Column(Unicode(200), nullable=True)
    supersedes_id = Column(Integer, ForeignKey("pass_weighments.id"), nullable=True)
    captured_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class QualityResult(Base):
    __tablename__ = "quality_results"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    result = Column(String(10), nullable=False)
    source = Column(String(10), nullable=False)
    inspected_by_name = Column(Unicode(100), nullable=True)
    inspected_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    inspected_at = Column(DateTime, nullable=True)
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    remarks = Column(Unicode(500), nullable=True)
    is_current = Column(Boolean, nullable=False, default=True)

    lines = relationship("QualityResultLine", cascade="all, delete-orphan")


class QualityResultLine(Base):
    __tablename__ = "quality_result_lines"

    id = Column(Integer, primary_key=True, index=True)
    quality_result_id = Column(Integer, ForeignKey("quality_results.id"), nullable=False, index=True)
    challan_line_id = Column(Integer, ForeignKey("pass_challan_lines.id"), nullable=False)
    accepted_qty = Column(QUANTITY_PRECISION, nullable=False)
    rejected_qty = Column(QUANTITY_PRECISION, nullable=False)
    remarks = Column(Unicode(200), nullable=True)


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, unique=True)
    status = Column(String(10), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    erp_status = Column(String(15), nullable=True, index=True)
    erp_grn_number = Column(String(50), nullable=True)
    erp_attempts = Column(Integer, nullable=False, default=0)
    erp_last_error = Column(Unicode(500), nullable=True)
    erp_last_attempt_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String(64), nullable=False, unique=True)
    # Unique where set; SQL Server allows only one NULL in a plain unique index, so the
    # migration script creates it as a filtered index.
    return_pass_number = Column(String(20), nullable=True)

    lines = relationship("GoodsReceiptLine", cascade="all, delete-orphan")


class GoodsReceiptLine(Base):
    __tablename__ = "goods_receipt_lines"

    id = Column(Integer, primary_key=True, index=True)
    goods_receipt_id = Column(Integer, ForeignKey("goods_receipts.id"), nullable=False, index=True)
    challan_line_id = Column(Integer, ForeignKey("pass_challan_lines.id"), nullable=True)
    material = Column(Unicode(200), nullable=False)
    uom = Column(String(20), nullable=False)
    po_qty = Column(QUANTITY_PRECISION, nullable=True)
    challan_qty = Column(QUANTITY_PRECISION, nullable=False)
    received_qty = Column(QUANTITY_PRECISION, nullable=False)
    accepted_qty = Column(QUANTITY_PRECISION, nullable=False)
    rejected_qty = Column(QUANTITY_PRECISION, nullable=False)
    qty_edited = Column(Boolean, nullable=False, default=False)
    remarks = Column(Unicode(200), nullable=True)


class PassAuditLog(Base):
    """Insert-only trail of state changes and manual edits."""

    __tablename__ = "pass_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    action = Column(String(40), nullable=False)
    field = Column(String(50), nullable=True)
    old_value = Column(Unicode(500), nullable=True)
    new_value = Column(Unicode(500), nullable=True)
    is_manual_override = Column(Boolean, nullable=False, default=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_service = Column(String(30), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class IntegrationEvent(Base):
    """Outbox of events for other systems; delivery to a bus is out of scope."""

    __tablename__ = "integration_events"

    id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String(60), nullable=False)
    version = Column(Integer, nullable=False)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    payload = Column(UnicodeText, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(60), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
