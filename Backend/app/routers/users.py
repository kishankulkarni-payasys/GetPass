from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import true
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.database import get_db
from app.models import (
    GoodsReceipt,
    PassAuditLog,
    PassWeighment,
    QualityResult,
    User,
    VehicleEntry,
    VehicleEntryPhoto,
)
from app.schemas import UserCreate, UserOut, UserUpdate

ADMIN_ROLE = "admin"
LAST_ADMIN_DETAIL = "At least one active admin is required"

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])


def _is_active_admin(user: User) -> bool:
    return user.role == ADMIN_ROLE and bool(user.is_active)


def _count_other_active_admins(db: Session, user_id: int) -> int:
    return (
        db.query(User)
        .filter(User.role == ADMIN_ROLE, User.is_active == true(), User.id != user_id)
        .count()
    )


def _ensure_another_active_admin(db: Session, user: User) -> None:
    # Removing the only active admin would lock everyone out of user management.
    if _is_active_admin(user) and _count_other_active_admins(db, user.id) == 0:
        raise HTTPException(status_code=400, detail=LAST_ADMIN_DETAIL)


# Every column that points at users.id; deleting a user referenced by any of them would
# fail on the foreign key, so such users must be deactivated instead.
USER_REFERENCE_COLUMNS = (
    VehicleEntry.weighed_by_id,
    VehicleEntry.created_by_id,
    VehicleEntryPhoto.uploaded_by_id,
    PassWeighment.captured_by_id,
    QualityResult.inspected_by_id,
    GoodsReceipt.created_by_id,
    GoodsReceipt.approved_by_id,
    PassAuditLog.actor_user_id,
)


def _has_pass_records(db: Session, user_id: int) -> bool:
    return any(
        db.query(column).filter(column == user_id).first() is not None
        for column in USER_REFERENCE_COLUMNS
    )


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request created the same username between the check and the commit.
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    db.refresh(user)
    return user


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.username).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _validate_user_update(db: Session, user: User, payload: UserUpdate, current_user: User) -> None:
    is_self = user.id == current_user.id
    role_changes = payload.role is not None and payload.role != user.role
    if is_self and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if is_self and role_changes:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    loses_admin = role_changes and payload.role != ADMIN_ROLE
    deactivates = payload.is_active is False
    if loses_admin or deactivates:
        _ensure_another_active_admin(db, user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _validate_user_update(db, user, payload, current_user)

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_another_active_admin(db, user)
    if _has_pass_records(db, user_id):
        raise HTTPException(
            status_code=409,
            detail="This user has weighbridge records and cannot be deleted. Deactivate the account instead.",
        )
    db.delete(user)
    db.commit()
    return None
