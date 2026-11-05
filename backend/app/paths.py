"""App data directory helpers for IMEI Data Maker.

Windows: %APPDATA%/InvoiceMaker/
macOS:   ~/Library/Application Support/InvoiceMaker
Linux:   $XDG_DATA_HOME/InvoiceMaker or ~/.local/share/InvoiceMaker

Override (any OS): set INVOICE_MAKER_DATA_DIR to an absolute path.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


APP_NAME = "InvoiceMaker"


def get_app_data_dir() -> Path:
    """Return the platform-specific InvoiceMaker app data directory."""
    override = os.environ.get("INVOICE_MAKER_DATA_DIR", "").strip()
    if override:
        root = Path(override).expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        return root

    if sys.platform == "win32":
        base = os.environ.get("APPDATA")
        if not base:
            base = str(Path.home() / "AppData" / "Roaming")
        root = Path(base) / APP_NAME
    elif sys.platform == "darwin":
        # Standard macOS app support folder (spaces in path are fine with pathlib).
        root = Path.home() / "Library" / "Application Support" / APP_NAME
    else:
        xdg = os.environ.get("XDG_DATA_HOME")
        if xdg:
            root = Path(xdg) / APP_NAME
        else:
            root = Path.home() / ".local" / "share" / APP_NAME

    root.mkdir(parents=True, exist_ok=True)
    return root


def ensure_app_subdirs() -> dict[str, Path]:
    """Create and return standard app data subdirectories."""
    root = get_app_data_dir()
    subdirs = {
        "root": root,
        "signatures": root / "signatures",
        "stamps": root / "stamps",
        "logos": root / "logos",
        "invoices": root / "invoices",
        "backups": root / "backups",
        "logs": root / "logs",
    }
    for path in subdirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return subdirs


def get_db_path() -> Path:
    """Return the SQLite database file path."""
    return get_app_data_dir() / "app.db"


def get_database_url() -> str:
    """Return a SQLAlchemy SQLite URL for the app database."""
    db_path = get_db_path()
    # Absolute path works on Windows and POSIX (incl. spaces on macOS).
    return f"sqlite:///{db_path.as_posix()}"
