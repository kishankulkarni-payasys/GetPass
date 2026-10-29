"""Control-tower KPIs and live board (spec 8.7)."""

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, selectinload

from app.goods_receipts import ERP_FAILED, ERP_PENDING
from app.inward_schemas import DashboardKpis, DashboardRow, DashboardSummary
from app.models import GoodsReceipt, VehicleEntry
from app.pass_queries import elapsed_minutes, utc_now_naive
from app.pass_states import (
    CANCELLED,
    DISPLAY_GRN_PENDING_POST,
    DISPLAY_GRN_POSTED,
    DISPLAY_RETURN_ONLY,
    GATE_IN,
    GATE_OUT,
    GRN_DRAFT,
    ON_SITE,
    OPEN_STATES,
    PASS_TYPE_INWARD,
    QUALITY_PENDING,
    QUALITY_RESOLVED,
    display_state,
)
from app.pass_views import dwell_minutes
from app.site_settings import DWELL_SLA_MINUTES, QUALITY_SLA_MINUTES, site_day_bounds_utc

QTY_SOURCE_CHALLAN = "challan"
TONE_NEUTRAL = "neutral"
# Pill tone per display state (spec 5.1); the frontend uses it to colour the board rows.
DISPLAY_STATE_TONES = {
    GATE_IN: "warn",
    ON_SITE: "warn",
    QUALITY_PENDING: "crit",
    QUALITY_RESOLVED: "good",
    GRN_DRAFT: "good",
    DISPLAY_GRN_POSTED: "info",
    DISPLAY_GRN_PENDING_POST: "crit",
    DISPLAY_RETURN_ONLY: "warn",
    GATE_OUT: TONE_NEUTRAL,
    CANCELLED: TONE_NEUTRAL,
}


def _is_quality_over_sla(entry: VehicleEntry, now: datetime) -> bool:
    minutes = elapsed_minutes(entry.pass_state_changed_at, now)
    return entry.pass_state == QUALITY_PENDING and minutes is not None and minutes > QUALITY_SLA_MINUTES


def _closed_dwell(entry: VehicleEntry, now: datetime) -> int:
    # A cancelled pass has no exit time; its dwell stops when it was cancelled.
    return dwell_minutes(entry, entry.pass_state_changed_at or now)


def _board_row(entry: VehicleEntry, now: datetime) -> DashboardRow:
    is_open = entry.pass_state in OPEN_STATES
    dwell = dwell_minutes(entry, now) if is_open else _closed_dwell(entry, now)
    erp_status = entry.goods_receipt.erp_status if entry.goods_receipt else None
    shown = display_state(entry.pass_state, erp_status)
    return DashboardRow(
        id=entry.id,
        vehicle_number=entry.vehicle_number,
        supplier=entry.supplier_transporter_name,
        pass_type=entry.pass_type,
        pass_state=entry.pass_state,
        display_state=shown,
        tone=DISPLAY_STATE_TONES.get(shown, TONE_NEUTRAL),
        erp_status=erp_status,
        dwell_minutes=dwell,
        minutes_in_state=elapsed_minutes(entry.pass_state_changed_at or entry.entry_time, now) if is_open else None,
        over_sla=dwell > DWELL_SLA_MINUTES or _is_quality_over_sla(entry, now),
        qty_source=QTY_SOURCE_CHALLAN if entry.pass_type == PASS_TYPE_INWARD else None,
    )


def _board_entries(db: Session, day_start: datetime, day_end: datetime) -> List[VehicleEntry]:
    """Open passes of any day plus passes that left or were cancelled on the chosen day."""
    exited_on_day = and_(VehicleEntry.pass_state == GATE_OUT, VehicleEntry.exit_time >= day_start, VehicleEntry.exit_time < day_end)
    cancelled_on_day = and_(
        VehicleEntry.pass_state == CANCELLED,
        VehicleEntry.pass_state_changed_at >= day_start,
        VehicleEntry.pass_state_changed_at < day_end,
    )
    return (
        db.query(VehicleEntry)
        .options(selectinload(VehicleEntry.goods_receipt))
        .filter(or_(VehicleEntry.pass_state.in_(OPEN_STATES), exited_on_day, cancelled_on_day))
        .all()
    )


def _average_dwell(entries: List[VehicleEntry], day_start: datetime, day_end: datetime) -> Optional[int]:
    exited = [entry for entry in entries if entry.exit_time is not None and day_start <= entry.exit_time < day_end]
    if not exited:
        return None
    return round(sum(dwell_minutes(entry) for entry in exited) / len(exited))


def _kpis(db: Session, entries: List[VehicleEntry], day_start: datetime, day_end: datetime, now: datetime) -> DashboardKpis:
    open_entries = [entry for entry in entries if entry.pass_state in OPEN_STATES]
    awaiting = [entry for entry in open_entries if entry.pass_state == QUALITY_PENDING]
    pending_post = (
        db.query(func.count(GoodsReceipt.id)).filter(GoodsReceipt.erp_status.in_((ERP_PENDING, ERP_FAILED))).scalar()
    )
    vehicles_today = (
        db.query(func.count(VehicleEntry.id))
        .filter(VehicleEntry.entry_time >= day_start, VehicleEntry.entry_time < day_end)
        .scalar()
    )
    return DashboardKpis(
        on_site_now=len(open_entries),
        awaiting_quality=len(awaiting),
        quality_over_sla=sum(1 for entry in awaiting if _is_quality_over_sla(entry, now)),
        grn_pending_post=pending_post or 0,
        avg_dwell_minutes=_average_dwell(entries, day_start, day_end),
        vehicles_today=vehicles_today or 0,
    )


def build_dashboard_summary(db: Session, day: date) -> DashboardSummary:
    now = utc_now_naive()
    day_start, day_end = site_day_bounds_utc(day)
    entries = _board_entries(db, day_start, day_end)
    rows = [_board_row(entry, now) for entry in entries]
    # Open passes first, then the longest dwell first within each group.
    rows.sort(key=lambda row: (row.pass_state not in OPEN_STATES, -row.dwell_minutes))
    return DashboardSummary(
        day=day,
        generated_at=now,
        dwell_sla_minutes=DWELL_SLA_MINUTES,
        quality_sla_minutes=QUALITY_SLA_MINUTES,
        kpis=_kpis(db, entries, day_start, day_end, now),
        board=rows,
    )
