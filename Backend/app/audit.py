"""Insert-only audit trail for passes."""

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import PassAuditLog, User

MAX_AUDIT_VALUE_LENGTH = 500
MAX_AUDIT_FIELD_LENGTH = 50
MAX_AUDIT_SERVICE_LENGTH = 30


def _to_audit_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)[:MAX_AUDIT_VALUE_LENGTH]


def record_audit(
    db: Session,
    entry_id: int,
    action: str,
    field: Optional[str] = None,
    old_value: Any = None,
    new_value: Any = None,
    is_manual_override: bool = False,
    actor: Optional[User] = None,
    actor_service: Optional[str] = None,
) -> PassAuditLog:
    """Add one audit row to the session; the caller commits with its own change.

    Callers must never pass driver phone numbers, tokens, secrets or image URLs as values.
    """
    row = PassAuditLog(
        entry_id=entry_id,
        action=action,
        field=field[:MAX_AUDIT_FIELD_LENGTH] if field else None,
        old_value=_to_audit_text(old_value),
        new_value=_to_audit_text(new_value),
        is_manual_override=is_manual_override,
        actor_user_id=actor.id if actor else None,
        actor_service=actor_service[:MAX_AUDIT_SERVICE_LENGTH] if actor_service else None,
    )
    db.add(row)
    return row
