"""Run Alembic upgrades (dev uvicorn and packaged sidecar)."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

logger = logging.getLogger("invoice_maker.migrate")


def _backend_root() -> Path:
    """Directory that contains alembic.ini + alembic/ (source or PyInstaller)."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    # backend/app/migrate.py → backend/
    return Path(__file__).resolve().parents[1]


def run_alembic_upgrade() -> None:
    """Apply migrations to head against the app-data SQLite database."""
    from alembic import command
    from alembic.config import Config

    from app.paths import ensure_app_subdirs, get_database_url

    ensure_app_subdirs()
    root = _backend_root()
    ini_path = root / "alembic.ini"
    script_location = root / "alembic"

    if not ini_path.is_file():
        raise FileNotFoundError(f"alembic.ini not found at {ini_path}")
    if not script_location.is_dir():
        raise FileNotFoundError(f"alembic script folder not found at {script_location}")

    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(script_location))
    cfg.set_main_option("sqlalchemy.url", get_database_url())

    logger.info("Running alembic upgrade head (db=%s)", get_database_url())
    command.upgrade(cfg, "head")
    logger.info("Alembic upgrade complete")
