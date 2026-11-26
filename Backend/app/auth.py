import hmac
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import Cookie, Depends, Header, HTTPException
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


def _load_password_recovery_key() -> bytes:
    key = os.getenv("PASSWORD_RECOVERY_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "PASSWORD_RECOVERY_KEY must be set to a Fernet key. "
            'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    return key.encode("utf-8")


SECRET_KEY = _load_secret_key()
_password_recovery_fernet = Fernet(_load_password_recovery_key())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")
    # bcrypt rejects input over 72 bytes; such a password can never match a stored hash.
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


def encrypt_recoverable_password(password: str) -> str:
    """Reversible encryption so an admin can recover a forgotten password.

    Not plaintext storage: without PASSWORD_RECOVERY_KEY (kept out of the database) the
    stored value is unreadable, unlike a plain password column.
    """
    return _password_recovery_fernet.encrypt(password.encode("utf-8")).decode("utf-8")


def decrypt_recoverable_password(token: str) -> Optional[str]:
    try:
        return _password_recovery_fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if authorization and authorization.lower().startswith("bearer "):
        access_token = authorization.split(None, 1)[1].strip()
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


PASSWORD_RESET_TOKEN_BYTES = 32
PASSWORD_RESET_EXPIRE_MINUTES = 30

ROLE_ADMIN = "admin"
ROLE_SECURITY_GUARD = "security_guard"
ROLE_WEIGHBRIDGE_OPERATOR = "weighbridge_operator"
ROLE_STORE_INCHARGE = "store_incharge"
ROLE_QUALITY_INSPECTOR = "quality_inspector"
ROLE_SITE_SUPERVISOR = "site_supervisor"

# Permission groups from the roles matrix (spec section 7). Guards are allow-lists so a new
# role gets nothing until it is added here.
GATE_IN_ROLES = (ROLE_ADMIN, ROLE_SECURITY_GUARD)
GATE_OUT_ROLES = (ROLE_ADMIN, ROLE_SECURITY_GUARD)
WEIGH_ROLES = (ROLE_ADMIN, ROLE_WEIGHBRIDGE_OPERATOR)
STORE_ROLES = (ROLE_ADMIN, ROLE_STORE_INCHARGE)
QUALITY_ROLES = (ROLE_ADMIN, ROLE_QUALITY_INSPECTOR)
DASHBOARD_ROLES = (ROLE_ADMIN, ROLE_STORE_INCHARGE, ROLE_SITE_SUPERVISOR)
GRN_LIST_ROLES = (ROLE_ADMIN, ROLE_STORE_INCHARGE, ROLE_SITE_SUPERVISOR)
RETURN_PASS_PRINT_ROLES = (ROLE_ADMIN, ROLE_SECURITY_GUARD, ROLE_STORE_INCHARGE)

ROLE_NOT_ALLOWED_DETAIL = "Your role cannot do this"
QUALITY_INTEGRATION_OFF_DETAIL = "Quality integration is not configured"
INVALID_SERVICE_KEY_DETAIL = "Invalid service key"
QUALITY_SERVICE_NAME = "quality_service"


def require_roles(*allowed_roles: str):
    """Dependency factory: only users whose role is in `allowed_roles` pass."""
    allowed = frozenset(allowed_roles)

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail=ROLE_NOT_ALLOWED_DETAIL)
        return user

    return dependency


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(PASSWORD_RESET_TOKEN_BYTES)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_quality_service(x_service_key: Optional[str] = Header(default=None)) -> str:
    """Authenticate the external Quality app by shared secret instead of a user cookie."""
    secret = os.getenv("QUALITY_INBOUND_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail=QUALITY_INTEGRATION_OFF_DETAIL)
    supplied = (x_service_key or "").encode("utf-8")
    # Constant-time comparison so the key cannot be guessed byte by byte from response times.
    if not hmac.compare_digest(supplied, secret.encode("utf-8")):
        raise HTTPException(status_code=401, detail=INVALID_SERVICE_KEY_DETAIL)
    return QUALITY_SERVICE_NAME
