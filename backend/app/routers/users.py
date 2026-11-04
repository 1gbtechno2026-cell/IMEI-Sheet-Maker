"""ADMIN user management: create / edit / deactivate / reset password."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession, require_permission
from app.models import User
from app.schemas.auth import UserOut
from app.schemas.users import (
    CreateUserRequest,
    ResetPasswordRequest,
    UpdateUserRequest,
    UserListOut,
)
from app.security import hash_password
from app.services import auth_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UserListOut)
def list_users(
    db: DbSession,
    _admin: User = Depends(require_permission("users")),
) -> UserListOut:
    rows = db.scalars(select(User).order_by(User.id)).all()
    return UserListOut(users=[auth_service.user_to_out(u) for u in rows])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    db: DbSession,
    _admin: User = Depends(require_permission("users")),
) -> UserOut:
    existing = db.scalar(select(User).where(User.username == body.username.strip()))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    user = User(
        name=body.name.strip(),
        username=body.username.strip(),
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return auth_service.user_to_out(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: DbSession,
    admin: CurrentUser,
) -> UserOut:
    from app.rbac import role_allowed

    if not role_allowed(admin.role, "users"):
        raise HTTPException(status_code=403, detail="Missing permission: users")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.name is not None:
        user.name = body.name.strip()
    if body.role is not None:
        # Prevent removing the last active admin
        if user.role == "ADMIN" and body.role != "ADMIN":
            admins = db.scalars(
                select(User).where(User.role == "ADMIN", User.is_active.is_(True))
            ).all()
            if len(admins) <= 1 and user.is_active:
                raise HTTPException(status_code=400, detail="Cannot demote the last active ADMIN")
        user.role = body.role
    if body.is_active is not None:
        if user.id == admin.id and body.is_active is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        if user.role == "ADMIN" and body.is_active is False:
            admins = db.scalars(
                select(User).where(User.role == "ADMIN", User.is_active.is_(True))
            ).all()
            if len(admins) <= 1:
                raise HTTPException(status_code=400, detail="Cannot deactivate the last active ADMIN")
        user.is_active = body.is_active

    db.add(user)
    db.commit()
    db.refresh(user)
    return auth_service.user_to_out(user)


@router.post("/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: int,
    db: DbSession,
    admin: CurrentUser,
) -> UserOut:
    return update_user(user_id, UpdateUserRequest(is_active=False), db, admin)


@router.post("/{user_id}/activate", response_model=UserOut)
def activate_user(
    user_id: int,
    db: DbSession,
    admin: CurrentUser,
) -> UserOut:
    return update_user(user_id, UpdateUserRequest(is_active=True), db, admin)


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: int,
    body: ResetPasswordRequest,
    db: DbSession,
    _admin: User = Depends(require_permission("users")),
) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = body.must_change_password
    db.add(user)
    db.commit()
    db.refresh(user)
    return auth_service.user_to_out(user)
