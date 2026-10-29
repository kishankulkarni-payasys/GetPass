"""Site-wide settings read from the environment (timezone, SLAs, OCR confidence threshold).

Values are read once at import; change the environment and restart the API to apply new values.
"""

import logging
import os
from datetime import date, datetime, timedelta, timezone, tzinfo
from typing import Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_SITE_TIMEZONE = "Asia/Kolkata"
DEFAULT_DWELL_SLA_MINUTES = 120
DEFAULT_QUALITY_SLA_MINUTES = 60
DEFAULT_OCR_CONFIDENCE_THRESHOLD = 85.0
MIN_CONFIDENCE = 0.0
MAX_CONFIDENCE = 100.0
MIN_SLA_MINUTES = 1

# Windows has no system time zone database; without the optional `tzdata` package zoneinfo
# cannot load any zone. These zones have no daylight saving, so a fixed offset is exact.
FIXED_OFFSET_FALLBACKS = {
    "Asia/Kolkata": timedelta(hours=5, minutes=30),
    "Asia/Calcutta": timedelta(hours=5, minutes=30),
    "UTC": timedelta(0),
}


def _read_int_env(name: str, default: int, minimum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be a whole number, got an invalid value")
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}")
    return value


def _read_confidence_env(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be a number between {MIN_CONFIDENCE:g} and {MAX_CONFIDENCE:g}")
    if not MIN_CONFIDENCE <= value <= MAX_CONFIDENCE:
        raise RuntimeError(f"{name} must be a number between {MIN_CONFIDENCE:g} and {MAX_CONFIDENCE:g}")
    return value


def _load_timezone(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        pass
    offset = FIXED_OFFSET_FALLBACKS.get(name)
    if offset is None:
        raise RuntimeError(
            f"SITE_TIMEZONE '{name}' is not available. Install the 'tzdata' package or use one of: "
            + ", ".join(sorted(FIXED_OFFSET_FALLBACKS))
        )
    logger.info("Time zone database not available; using a fixed offset for %s", name)
    return timezone(offset, name)


SITE_TIMEZONE_NAME = os.getenv("SITE_TIMEZONE", "").strip() or DEFAULT_SITE_TIMEZONE
SITE_TIMEZONE = _load_timezone(SITE_TIMEZONE_NAME)
DWELL_SLA_MINUTES = _read_int_env("DWELL_SLA_MINUTES", DEFAULT_DWELL_SLA_MINUTES, MIN_SLA_MINUTES)
QUALITY_SLA_MINUTES = _read_int_env("QUALITY_SLA_MINUTES", DEFAULT_QUALITY_SLA_MINUTES, MIN_SLA_MINUTES)
# OCR fields with a confidence (0-100) below this are highlighted and must be confirmed by the guard.
OCR_CONFIDENCE_THRESHOLD = _read_confidence_env("OCR_CONFIDENCE_THRESHOLD", DEFAULT_OCR_CONFIDENCE_THRESHOLD)


def get_ocr_confidence_threshold() -> float:
    return OCR_CONFIDENCE_THRESHOLD


def get_site_timezone() -> tzinfo:
    return SITE_TIMEZONE


def site_today() -> date:
    """Today's date at the site, which differs from the UTC date around midnight."""
    return datetime.now(timezone.utc).astimezone(SITE_TIMEZONE).date()


def _to_naive_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def site_day_bounds_utc(day: date) -> Tuple[datetime, datetime]:
    """Start (inclusive) and end (exclusive) of a site-local day as naive UTC, matching the columns."""
    local_start = datetime(day.year, day.month, day.day, tzinfo=SITE_TIMEZONE)
    return _to_naive_utc(local_start), _to_naive_utc(local_start + timedelta(days=1))
