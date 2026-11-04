"""Dashboard metrics."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import require_permission
from app.deps import DbSession
from app.models import User
from app.services.dashboard import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    db: DbSession,
    _user: User = Depends(require_permission("dashboard")),
) -> dict:
    return get_dashboard(db)
