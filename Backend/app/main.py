import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.integrations.ocr import get_ocr_adapter
from app.integrations.po_lookup import get_po_lookup_adapter
from app.integrations.weighbridge_indicator import get_indicator_adapter
from app.models import User
from app.routers import (
    auth,
    dashboard,
    entries,
    gate_in,
    grn,
    quality,
    quality_integration,
    uploads,
    users,
    weighments,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# The password shipped in .env.example; never let it become a real admin password.
PLACEHOLDER_ADMIN_PASSWORD = "ChangeMe123!"
MIN_ADMIN_PASSWORD_LENGTH = 8

app = FastAPI(title="GatePass API")

# Build the adapters now so a provider set to "http" without its URL / key stops the
# server at startup instead of failing on the first gate-in.
get_ocr_adapter()
get_po_lookup_adapter()
get_indicator_adapter()

Base.metadata.create_all(bind=engine)


def _read_bootstrap_password() -> str:
    password = os.getenv("DEFAULT_ADMIN_PASSWORD", "")
    if len(password.strip()) < MIN_ADMIN_PASSWORD_LENGTH or password == PLACEHOLDER_ADMIN_PASSWORD:
        raise RuntimeError(
            "No users exist yet, so a first admin must be created. Set DEFAULT_ADMIN_PASSWORD to a "
            f"non-placeholder password of at least {MIN_ADMIN_PASSWORD_LENGTH} characters."
        )
    return password


def _bootstrap_admin():
    db = SessionLocal()
    try:
        if db.query(User).first() is not None:
            return
        admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
        admin = User(
            username=admin_username,
            password_hash=hash_password(_read_bootstrap_password()),
            full_name="Default Admin",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.warning("Created default admin user '%s' - change this password immediately.", admin_username)
    finally:
        db.close()


_bootstrap_admin()

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(users.router)
app.include_router(uploads.router)
app.include_router(gate_in.router)
app.include_router(weighments.router)
app.include_router(quality.router)
app.include_router(quality_integration.router)
app.include_router(grn.router)
app.include_router(dashboard.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log only method and path; query strings and bodies can carry personal data.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
