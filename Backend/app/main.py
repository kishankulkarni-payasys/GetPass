import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import auth, entries, users

app = FastAPI(title="GatePass API")

Base.metadata.create_all(bind=engine)


def _bootstrap_admin():
    db = SessionLocal()
    try:
        if db.query(User).first() is None:
            admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
            admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "ChangeMe123!")
            admin = User(
                username=admin_username,
                password_hash=hash_password(admin_password),
                full_name="Default Admin",
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"Created default admin user '{admin_username}' - change this password immediately.")
    finally:
        db.close()


_bootstrap_admin()

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(users.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
