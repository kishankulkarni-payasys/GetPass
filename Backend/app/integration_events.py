"""Outbox writer for events sent to other systems.

Rows are added in the caller's transaction so an event exists only if the change that caused it
was committed. Delivering the outbox to a bus is out of scope; consumers can pull instead.
"""

import json
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models import IntegrationEvent

INSPECTION_REQUESTED_EVENT = "Gatepass.InspectionRequested"
INSPECTION_REQUESTED_VERSION = 1
GRN_POSTED_EVENT = "Gatepass.GRNPosted"
GRN_POSTED_VERSION = 1


def record_event(db: Session, event_name: str, version: int, entry_id: int, payload: Dict[str, Any]) -> IntegrationEvent:
    """Add one outbox row to the session; the caller commits.

    Payloads must never carry driver phone numbers, secrets or image URLs.
    """
    event = IntegrationEvent(
        event_name=event_name,
        version=version,
        entry_id=entry_id,
        # default=str turns Decimal and datetime values into plain strings.
        payload=json.dumps(payload, default=str, ensure_ascii=False),
    )
    db.add(event)
    return event
