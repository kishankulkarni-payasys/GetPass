"""Small read helpers shared by the quality, GRN and dashboard modules."""

import math
from datetime import datetime, timezone
from typing import Iterator, List, Optional, Sequence

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import VehicleEntry

ENTRY_NOT_FOUND_DETAIL = "Entry not found"
# SQL Server allows about 2,100 parameters per statement; keep IN lists well below that.
IN_CLAUSE_CHUNK_SIZE = 500
SECONDS_PER_MINUTE = 60
# Row lock held until commit so two requests cannot move the same pass at once.
UPDATE_LOCK_HINT = "WITH (UPDLOCK, ROWLOCK)"


def get_entry_or_404(db: Session, entry_id: int, for_update: bool = False) -> VehicleEntry:
    query = db.query(VehicleEntry)
    if for_update:
        query = query.with_hint(VehicleEntry, UPDATE_LOCK_HINT, "mssql")
    entry = query.filter(VehicleEntry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND_DETAIL)
    return entry


def utc_now_naive() -> datetime:
    """Current UTC time without tzinfo, matching how every timestamp column is stored."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def elapsed_minutes(start: Optional[datetime], end: datetime) -> Optional[int]:
    """Whole minutes from start to end (naive UTC); never negative, None when start is unknown."""
    if start is None:
        return None
    return max(0, math.floor((end - start).total_seconds() / SECONDS_PER_MINUTE))


def chunked(values: Sequence[int], size: int = IN_CLAUSE_CHUNK_SIZE) -> Iterator[List[int]]:
    for index in range(0, len(values), size):
        yield list(values[index:index + size])
