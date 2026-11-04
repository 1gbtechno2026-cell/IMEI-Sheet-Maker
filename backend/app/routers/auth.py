"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbSession
from app.rbac import role_allowed
from app.schemas.auth import (
    BootstrapStatus,
    ChangePasswordRequest,
    LoginRequest,
    MessageOut,
    TokenResponse,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/bootstrap-status", response_model=BootstrapStatus)
def bootstrap_status(db: DbSession) -> BootstrapStatus:
    count = auth_service.count_users(db)
    return BootstrapStatus(needs_bootstrap=count == 0, user_count=count)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbSession) -> TokenResponse:
    # Ensure first-run admin exists before attempting login (idempotent).
    auth_service.ensure_default_admin(db)

    user = auth_service.authenticate(db, body.username.strip(), body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = auth_service.issue_token(user)
    return TokenResponse(access_token=token, user=auth_service.user_to_out(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return auth_service.user_to_out(user)


@router.post("/change-password", response_model=TokenResponse)
def change_password(body: ChangePasswordRequest, db: DbSession, user: CurrentUser) -> TokenResponse:
    try:
        updated = auth_service.change_password(
            db, user, body.current_password, body.new_password
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    token = auth_service.issue_token(updated)
    return TokenResponse(access_token=token, user=auth_service.user_to_out(updated))


@router.post("/logout", response_model=MessageOut)
def logout(_user: CurrentUser) -> MessageOut:
    # JWT is stateless; client must discard the token. Endpoint exists for explicit logout UX.
    return MessageOut(message="Logged out")


@router.get("/permissions-check/{permission}")
def permissions_check(permission: str, user: CurrentUser) -> dict:
    """Test helper: whether the current user has a named permission."""
    return {
        "permission": permission,
        "allowed": role_allowed(user.role, permission),
        "role": user.role,
    }
