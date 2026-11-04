"""SQLite app.db backup / restore helpers."""

from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.paths import ensure_app_subdirs, get_db_path

KEEP_LAST = 10


def list_backups() -> list[dict]:
    dirs = ensure_app_subdirs()
    files = sorted(dirs["backups"].glob("app-*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {
            "filename": f.name,
            "path": str(f),
            "size_bytes": f.stat().st_size,
            "modified_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
        for f in files
    ]


def prune_backups(keep: int = KEEP_LAST, protect: set[str] | None = None) -> None:
    dirs = ensure_app_subdirs()
    protect = protect or set()
    # Prefer filename stamp (includes µs) so newest-created wins even when mtimes tie.
    files = sorted(
        dirs["backups"].glob("app-*.db"),
        key=lambda p: p.name,
        reverse=True,
    )
    kept = 0
    for f in files:
        if f.name in protect or kept < keep:
            kept += 1
            continue
        try:
            f.unlink()
        except OSError:
            pass


def create_backup(*, label: str = "manual") -> dict:
    """Copy app.db into backups/. Returns metadata."""
    dirs = ensure_app_subdirs()
    src = get_db_path()
    if not src.is_file():
        raise FileNotFoundError("app.db does not exist yet")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    safe_label = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in label)[:32]
    dest = dirs["backups"] / f"app-{stamp}-{safe_label}.db"
    shutil.copy2(src, dest)
    # Keep the file we just wrote even if mtimes collide under load.
    prune_backups(keep=KEEP_LAST, protect={dest.name})
    st = dest.stat()
    return {
        "filename": dest.name,
        "path": str(dest),
        "size_bytes": st.st_size,
        "modified_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
    }


def restore_backup(filename: str) -> dict:
    """Replace app.db with a backup file (after taking a pre-restore snapshot)."""
    dirs = ensure_app_subdirs()
    # Prevent path traversal
    name = Path(filename).name
    src = dirs["backups"] / name
    if not src.is_file():
        raise FileNotFoundError(f"Backup not found: {name}")

    db_path = get_db_path()
    # Safety snapshot of current DB
    if db_path.is_file():
        create_backup(label="pre-restore")

    shutil.copy2(src, db_path)
    return {
        "restored_from": name,
        "db_path": str(db_path),
        "message": "Database restored. Restart the API/app to reload connections.",
    }


def auto_backup_on_start() -> dict | None:
    """Create a startup backup if app.db exists; keep last 10."""
    src = get_db_path()
    if not src.is_file():
        return None
    try:
        return create_backup(label="auto")
    except Exception:
        return None
