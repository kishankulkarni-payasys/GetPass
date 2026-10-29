"""Retry ERP posts for approved GRNs that are still pending or failed.

Meant for Windows Task Scheduler. Run from the Backend/ directory:
    python -m scripts.retry_grn_posts
Retries only GRNs whose last attempt is older than GRN_RETRY_MIN_INTERVAL_MINUTES and that have had
fewer than GRN_MAX_AUTO_ATTEMPTS attempts. Manual retry from the GRN screen stays available beyond
the cap. Each retry uses the GRN's own idempotency key, so the ERP never books it twice.
Prints counts only, never GRN contents. Exit code 1 when any GRN hit an unexpected error.
"""

import logging
import os
import sys
from datetime import datetime, timedelta
from typing import List

from dotenv import load_dotenv
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.goods_receipts import ERP_FAILED, GRN_STATUS_APPROVED
from app.grn_posting import POSTABLE_ERP_STATUSES, post_goods_receipt
from app.models import GoodsReceipt
from app.pass_queries import get_entry_or_404, utc_now_naive

load_dotenv()

logger = logging.getLogger("retry_grn_posts")

DEFAULT_MIN_INTERVAL_MINUTES = 10
DEFAULT_MAX_AUTO_ATTEMPTS = 10
RETRY_JOB_SERVICE_NAME = "grn_retry_job"
EXIT_OK = 0
EXIT_ERRORS = 1


def _read_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be a whole number")
    if value < 1:
        raise RuntimeError(f"{name} must be at least 1")
    return value


def find_due_receipt_ids(db: Session, min_interval_minutes: int, max_attempts: int, now: datetime) -> List[int]:
    cutoff = now - timedelta(minutes=min_interval_minutes)
    rows = (
        db.query(GoodsReceipt.id)
        .filter(
            GoodsReceipt.status == GRN_STATUS_APPROVED,
            GoodsReceipt.erp_status.in_(POSTABLE_ERP_STATUSES),
            GoodsReceipt.erp_attempts < max_attempts,
            or_(GoodsReceipt.erp_last_attempt_at.is_(None), GoodsReceipt.erp_last_attempt_at < cutoff),
        )
        .order_by(GoodsReceipt.id)
        .all()
    )
    return [receipt_id for (receipt_id,) in rows]


def retry_one(db: Session, receipt_id: int) -> bool:
    """Returns True when the GRN is now posted."""
    receipt = db.get(GoodsReceipt, receipt_id)
    # The entry row lock is taken first so a manual retry from the screen cannot run at the same time.
    entry = get_entry_or_404(db, receipt.entry_id, for_update=True)
    db.refresh(receipt)
    if receipt.erp_status not in POSTABLE_ERP_STATUSES:
        db.rollback()
        return False
    post_goods_receipt(db, entry, receipt, actor_service=RETRY_JOB_SERVICE_NAME)
    return receipt.erp_status != ERP_FAILED


def run() -> int:
    min_interval = _read_positive_int("GRN_RETRY_MIN_INTERVAL_MINUTES", DEFAULT_MIN_INTERVAL_MINUTES)
    max_attempts = _read_positive_int("GRN_MAX_AUTO_ATTEMPTS", DEFAULT_MAX_AUTO_ATTEMPTS)
    db = SessionLocal()
    posted = not_posted = errors = 0
    try:
        due_ids = find_due_receipt_ids(db, min_interval, max_attempts, utc_now_naive())
        logger.info("GRNs due for an ERP retry: %d", len(due_ids))
        for receipt_id in due_ids:
            try:
                if retry_one(db, receipt_id):
                    posted += 1
                else:
                    not_posted += 1
            except Exception:
                # One bad GRN must not stop the others; it stays pending/failed for the next run.
                db.rollback()
                errors += 1
                logger.exception("Unexpected error retrying GRN %s", receipt_id)
    finally:
        db.close()
    logger.info("ERP retry finished: posted=%d not_posted=%d errors=%d", posted, not_posted, errors)
    return EXIT_ERRORS if errors else EXIT_OK


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    sys.exit(run())
