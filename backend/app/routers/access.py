"""Stub protected routes that enforce RBAC for Phase 2 (page shells hit these)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import require_permission
from app.models import User

router = APIRouter(prefix="/access", tags=["access"])


def _ok(feature: str, user: User) -> dict:
    return {"feature": feature, "ok": True, "role": user.role, "username": user.username}


@router.get("/dashboard")
def access_dashboard(user: User = Depends(require_permission("dashboard"))) -> dict:
    return _ok("dashboard", user)


@router.get("/onboarding")
def access_onboarding(user: User = Depends(require_permission("onboarding"))) -> dict:
    return _ok("onboarding", user)


@router.get("/invoicing")
def access_invoicing(user: User = Depends(require_permission("invoicing"))) -> dict:
    return _ok("invoicing", user)


@router.get("/history")
def access_history(user: User = Depends(require_permission("history"))) -> dict:
    return _ok("history", user)


@router.get("/all-invoices")
def access_all_invoices(user: User = Depends(require_permission("all_invoices"))) -> dict:
    return _ok("all_invoices", user)


@router.get("/settings")
def access_settings(user: User = Depends(require_permission("settings"))) -> dict:
    return _ok("settings", user)


@router.get("/users")
def access_users(user: User = Depends(require_permission("users"))) -> dict:
    return _ok("users", user)
