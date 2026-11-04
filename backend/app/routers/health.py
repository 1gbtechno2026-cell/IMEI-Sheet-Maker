"""Health check endpoint."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine
from app.paths import get_app_data_dir, get_db_path

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    db_ok = False
    db_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:  # noqa: BLE001 — surface status to UI
        db_error = str(exc)

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "invoice-maker-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "ok": db_ok,
            "path": str(get_db_path()),
            "error": db_error,
        },
        "app_data_dir": str(get_app_data_dir()),
    }
