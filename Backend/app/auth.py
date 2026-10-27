import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

load_dotenv()

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8
COOKIE_NAME = "access_token"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"
MIN_SECRET_KEY_LENGTH = 32
MAX_PASSWORD_BYTES = 72
# Values that have appeared in this repo; anyone who has read it could forge tokens with them.
KNOWN_PLACEHOLDER_SECRETS = {
    "dev-only-insecure-secret-change-me",
    "change-this-to-a-random-secret-in-your-local-env",
}


def _load_secret_key() -> str:
    secret = os.getenv("SECRET_KEY", "").strip()
    if not secret or secret in KNOWN_PLACEHOLDER_SECRETS or len(secret) < MIN_SECRET_KEY_LENGTH:
        raise RuntimeError(
            f"SECRET_KEY must be set to a random value of at least {MIN_SECRET_KEY_LENGTH} characters. "
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    return secret


SECRET_KEY = _load_secret_key()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")
    # bcrypt rejects input over 72 bytes; such a password can never match a stored hash.
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_entry_write(user: User = Depends(get_current_user)) -> User:
    if user.role == "weighbridge_operator":
        raise HTTPException(status_code=403, detail="Weighbridge operators cannot register or close out entries")
    return user


def require_weighbridge_write(user: User = Depends(get_current_user)) -> User:
    if user.role == "security_guard":
        raise HTTPException(status_code=403, detail="Security guards cannot record weights or upload weighbridge photos")
    return user
