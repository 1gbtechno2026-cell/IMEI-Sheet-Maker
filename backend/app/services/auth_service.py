"""Auth domain service: bootstrap default admin, login, password change."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User
from app.rbac import ROLE_PERMISSIONS
from app.schemas.auth import UserOut
from app.security import (
    DEFAULT_ADMIN_NAME,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    create_access_token,
    hash_password,
    verify_password,
)


def user_to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        username=user.username,
        role=user.role,  # type: ignore[arg-type]
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        created_at=user.created_at,
        permissions=sorted(ROLE_PERMISSIONS.get(user.role, set())),
    )


def count_users(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(User)) or 0)


def ensure_default_admin(db: Session) -> User | None:
    """Create the default admin on first run. Returns the user if created."""
    if count_users(db) > 0:
        return None

    admin = User(
        name=DEFAULT_ADMIN_NAME,
        username=DEFAULT_ADMIN_USERNAME,
        password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
        role="ADMIN",
        is_active=True,
        must_change_password=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_token(user: User) -> str:
    return create_access_token(user_id=user.id, username=user.username, role=user.role)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> User:
    if not verify_password(current_password, user.password_hash):
        raise ValueError("Current password is incorrect")
    if len(new_password) < 8:
        raise ValueError("New password must be at least 8 characters")
    if new_password == current_password:
        raise ValueError("New password must be different from the current password")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
