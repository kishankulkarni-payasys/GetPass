"""Vehicle pass state machine: the only place a pass_state may change."""

from dataclasses import dataclass
from datetime import datetime
from typing import FrozenSet, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.models import User, VehicleEntry

PASS_TYPE_INWARD = "inward"
PASS_TYPE_GENERAL = "general"
PASS_TYPES = (PASS_TYPE_INWARD, PASS_TYPE_GENERAL)

GATE_IN = "GATE_IN"
ON_SITE = "ON_SITE"
QUALITY_PENDING = "QUALITY_PENDING"
QUALITY_RESOLVED = "QUALITY_RESOLVED"
GRN_DRAFT = "GRN_DRAFT"
GRN_APPROVED = "GRN_APPROVED"
GATE_OUT = "GATE_OUT"
CANCELLED = "CANCELLED"

ALL_STATES = (GATE_IN, ON_SITE, QUALITY_PENDING, QUALITY_RESOLVED, GRN_DRAFT, GRN_APPROVED, GATE_OUT, CANCELLED)
TERMINAL_STATES = frozenset({GATE_OUT, CANCELLED})
OPEN_STATES = frozenset(ALL_STATES) - TERMINAL_STATES

# Re-capturing gross is allowed only while the material is still on site and the GRN is not approved.
GROSS_RECAPTURE_STATES = frozenset({ON_SITE, QUALITY_PENDING, QUALITY_RESOLVED, GRN_DRAFT})
INWARD_TARE_STATES = frozenset({ON_SITE, QUALITY_PENDING, QUALITY_RESOLVED, GRN_DRAFT, GRN_APPROVED})

# display_state values for GRN_APPROVED, which depend on the ERP post status (spec 5.1 / 5.3).
DISPLAY_GRN_POSTED = "GRN_POSTED"
DISPLAY_GRN_PENDING_POST = "GRN_PENDING_POST"
DISPLAY_RETURN_ONLY = "RETURN_ONLY"
ERP_STATUS_POSTED = "posted"
ERP_STATUS_NOT_REQUIRED = "not_required"

STATE_NOT_ALLOWED_DETAIL = "Action not allowed in the current pass state"
STATE_AUDIT_ACTION = "state_changed"
STATE_AUDIT_FIELD = "pass_state"


@dataclass(frozen=True)
class Transition:
    code: str
    from_state: str
    to_state: str
    pass_types: FrozenSet[str]


_BOTH_TYPES = frozenset(PASS_TYPES)
_INWARD_ONLY = frozenset({PASS_TYPE_INWARD})
_GENERAL_ONLY = frozenset({PASS_TYPE_GENERAL})

# Transition table from the spec (section 5.2). T1 (create) sets GATE_IN directly; T4b keeps the state.
TRANSITIONS = {
    "T2": Transition("T2", GATE_IN, ON_SITE, _INWARD_ONLY),
    "T3": Transition("T3", ON_SITE, QUALITY_PENDING, _INWARD_ONLY),
    "T4": Transition("T4", QUALITY_PENDING, QUALITY_RESOLVED, _INWARD_ONLY),
    "T5": Transition("T5", QUALITY_RESOLVED, GRN_DRAFT, _INWARD_ONLY),
    "T6": Transition("T6", GRN_DRAFT, GRN_APPROVED, _INWARD_ONLY),
    "T7": Transition("T7", GRN_APPROVED, GATE_OUT, _INWARD_ONLY),
    "T8": Transition("T8", GATE_IN, GATE_OUT, _GENERAL_ONLY),
    "T9": Transition("T9", GATE_IN, CANCELLED, _BOTH_TYPES),
}


def raise_state_conflict() -> None:
    raise HTTPException(status_code=409, detail=STATE_NOT_ALLOWED_DETAIL)


def is_transition_allowed(entry: VehicleEntry, code: str) -> bool:
    transition = TRANSITIONS.get(code)
    if transition is None:
        return False
    return entry.pass_state == transition.from_state and entry.pass_type in transition.pass_types


def ensure_state_in(entry: VehicleEntry, allowed_states: FrozenSet[str]) -> None:
    """Guard for actions that are not state changes (e.g. tare capture, GRN line edits)."""
    if entry.pass_state not in allowed_states:
        raise_state_conflict()


def apply_transition(
    db: Session,
    entry: VehicleEntry,
    code: str,
    actor: Optional[User] = None,
    actor_service: Optional[str] = None,
) -> None:
    """Move the pass along one transition and audit it; the caller commits.

    Raises 409 when the transition does not start from the pass's current state or
    does not apply to its pass type.
    """
    if not is_transition_allowed(entry, code):
        raise_state_conflict()
    old_state = entry.pass_state
    entry.pass_state = TRANSITIONS[code].to_state
    entry.pass_state_changed_at = datetime.utcnow()
    record_audit(
        db,
        entry_id=entry.id,
        action=STATE_AUDIT_ACTION,
        field=STATE_AUDIT_FIELD,
        old_value=old_state,
        new_value=entry.pass_state,
        actor=actor,
        actor_service=actor_service,
    )


def display_state(pass_state: str, erp_status: Optional[str]) -> str:
    """The state the screens show: GRN_APPROVED splits by ERP post outcome."""
    if pass_state != GRN_APPROVED:
        return pass_state
    if erp_status == ERP_STATUS_POSTED:
        return DISPLAY_GRN_POSTED
    if erp_status == ERP_STATUS_NOT_REQUIRED:
        return DISPLAY_RETURN_ONLY
    return DISPLAY_GRN_PENDING_POST
