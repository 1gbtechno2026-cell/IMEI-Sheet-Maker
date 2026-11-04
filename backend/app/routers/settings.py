"""Settings + backup/restore (ADMIN)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.deps import DbSession, require_permission
from app.models import User
from app.schemas.settings import BackupListOut, RestoreIn, SettingsOut, SettingsUpdateIn
from app.services import backup_service, settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(
    db: DbSession,
    _admin: User = Depends(require_permission("settings")),
) -> SettingsOut:
    return SettingsOut(**settings_service.get_all_settings(db))


@router.put("", response_model=SettingsOut)
def put_settings(
    body: SettingsUpdateIn,
    db: DbSession,
    _admin: User = Depends(require_permission("settings")),
) -> SettingsOut:
    try:
        data = settings_service.update_settings(
            db,
            fy_start_month=body.fy_start_month,
            default_currency=body.default_currency,
            pdf_footer_terms=body.pdf_footer_terms,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SettingsOut(**data)


@router.get("/backups", response_model=BackupListOut)
def list_backups(
    _admin: User = Depends(require_permission("settings")),
) -> BackupListOut:
    return BackupListOut(backups=backup_service.list_backups())


@router.post("/backups")
def create_backup(
    _admin: User = Depends(require_permission("settings")),
) -> dict:
    try:
        info = backup_service.create_backup(label="manual")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return info


@router.post("/backups/restore")
def restore_backup(
    body: RestoreIn,
    _admin: User = Depends(require_permission("settings")),
) -> dict:
    try:
        return backup_service.restore_backup(body.filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Restore failed: {exc}") from exc
