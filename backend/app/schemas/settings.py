"""Settings / backup schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    fy_start_month: int
    default_currency: str
    pdf_footer_terms: str
    app_data_dir: str
    db_path: str


class SettingsUpdateIn(BaseModel):
    fy_start_month: int | None = Field(default=None, ge=1, le=12)
    default_currency: str | None = Field(default=None, min_length=1, max_length=10)
    pdf_footer_terms: str | None = None


class BackupInfo(BaseModel):
    filename: str
    path: str
    size_bytes: int
    modified_at: str


class BackupListOut(BaseModel):
    backups: list[BackupInfo]


class RestoreIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
