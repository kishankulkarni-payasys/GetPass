from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import DASHBOARD_ROLES, get_current_user, require_roles
from app.dashboard_summary import build_dashboard_summary
from app.database import get_db
from app.inward_schemas import DashboardSummary
from app.site_settings import site_today

# Control-tower summary (spec 8.7).
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])

require_dashboard = require_roles(*DASHBOARD_ROLES)


@router.get("/summary", response_model=DashboardSummary, dependencies=[Depends(require_dashboard)])
def get_dashboard_summary(day: Optional[date] = None, db: Session = Depends(get_db)):
    """`day` is a site-local date (YYYY-MM-DD); defaults to today in SITE_TIMEZONE."""
    return build_dashboard_summary(db, day or site_today())
