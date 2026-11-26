from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    COOKIE_NAME,
    COOKIE_SECURE,
    PASSWORD_RESET_EXPIRE_MINUTES,
    create_access_token,
    encrypt_recoverable_password,
    generate_password_reset_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.integrations import AdapterError
from app.integrations.email import get_email_sender
from app.models import User
from app.schemas import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _find_user_by_identifier(db: Session, identifier: str) -> "User | None":
    identifier = identifier.strip()
    return (
        db.query(User)
        .filter(or_(User.username == identifier, User.email == identifier, User.contact_no == identifier))
        .first()
    )


@router.post("/login")
def login(credentials: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = _find_user_by_identifier(db, credentials.username)
    if not user or not user.is_active or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.id, user.role)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "access_token": token,
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, httponly=True, samesite="lax", secure=COOKIE_SECURE)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


# Same response either way, so probing for registered usernames/emails/numbers learns nothing.
FORGOT_PASSWORD_ACK = {"detail": "If that account exists, a reset link has been sent"}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = _find_user_by_identifier(db, payload.identifier)
    if not user or not user.is_active:
        return FORGOT_PASSWORD_ACK

    user.password_reset_token = generate_password_reset_token()
    user.password_reset_expires_at = datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    db.commit()

    if user.email:
        try:
            get_email_sender().send(
                to=user.email,
                subject="Reset your GetPass password",
                body=f"Use this code to reset your password: {user.password_reset_token}",
            )
        except AdapterError:
            pass  # Already logged by the adapter; the ack response does not change either way.
    return FORGOT_PASSWORD_ACK


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == payload.token).first()
    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(payload.password)
    user.password_recoverable = encrypt_recoverable_password(payload.password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()
    return {"detail": "Password has been reset"}
