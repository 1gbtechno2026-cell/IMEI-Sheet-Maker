"""Company-wide settings helpers (FY, currency, PDF footer)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Setting
from app.paths import get_app_data_dir, get_db_path

KEY_FY_START_MONTH = "fy_start_month"
KEY_DEFAULT_CURRENCY = "default_currency"
KEY_PDF_FOOTER = "pdf_footer_terms"


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.get(Setting, key)
    if row is None or row.value is None or row.value == "":
        return default
    return row.value


def set_setting(db: Session, key: str, value: str | None) -> Setting:
    row = db.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_fy_start_month(db: Session) -> int:
    raw = get_setting(db, KEY_FY_START_MONTH, "4") or "4"
    try:
        month = int(raw)
    except ValueError:
        month = 4
    if month < 1 or month > 12:
        return 4
    return month


def get_default_currency(db: Session) -> str:
    return get_setting(db, KEY_DEFAULT_CURRENCY, "INR") or "INR"


def get_pdf_footer(db: Session) -> str:
    return get_setting(db, KEY_PDF_FOOTER, "") or ""


def ensure_default_settings(db: Session) -> None:
    defaults = {
        KEY_FY_START_MONTH: "4",
        KEY_DEFAULT_CURRENCY: "INR",
        KEY_PDF_FOOTER: "",
    }
    for key, value in defaults.items():
        existing = db.get(Setting, key)
        if existing is None:
            db.add(Setting(key=key, value=value))
    db.commit()


def get_all_settings(db: Session) -> dict:
    return {
        "fy_start_month": get_fy_start_month(db),
        "default_currency": get_default_currency(db),
        "pdf_footer_terms": get_pdf_footer(db),
        "app_data_dir": str(get_app_data_dir()),
        "db_path": str(get_db_path()),
    }


def update_settings(
    db: Session,
    *,
    fy_start_month: int | None = None,
    default_currency: str | None = None,
    pdf_footer_terms: str | None = None,
) -> dict:
    if fy_start_month is not None:
        if fy_start_month < 1 or fy_start_month > 12:
            raise ValueError("fy_start_month must be 1–12")
        set_setting(db, KEY_FY_START_MONTH, str(fy_start_month))
    if default_currency is not None:
        cur = default_currency.strip().upper()
        if not cur or len(cur) > 10:
            raise ValueError("default_currency invalid")
        set_setting(db, KEY_DEFAULT_CURRENCY, cur)
    if pdf_footer_terms is not None:
        set_setting(db, KEY_PDF_FOOTER, pdf_footer_terms)
    return get_all_settings(db)
