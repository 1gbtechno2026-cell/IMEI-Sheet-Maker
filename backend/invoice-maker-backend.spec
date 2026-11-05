# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for IMEI Data Maker FastAPI sidecar.
# Build on Windows with Python 3.11:
#   .\.venv\Scripts\python.exe -m PyInstaller --noconfirm invoice-maker-backend.spec
#
# Output: dist/invoice-maker-backend/invoice-maker-backend.exe  (onedir)

from __future__ import annotations

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

SPECDIR = Path(SPECPATH).resolve()
BACKEND = SPECDIR

datas = [
    (str(BACKEND / "alembic.ini"), "."),
    (str(BACKEND / "alembic"), "alembic"),
]

binaries: list = []
hiddenimports: list[str] = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "app.main",
    "app.migrate",
    "app.models",
    "app.models.entities",
    "app.routers",
    "app.routers.access",
    "app.routers.auth",
    "app.routers.companies",
    "app.routers.dashboard",
    "app.routers.health",
    "app.routers.invoices",
    "app.routers.settings",
    "app.routers.users",
    "bcrypt",
    "jwt",
    "multipart",
    "openpyxl",
    "pandas",
    "PIL",
    "reportlab",
    "sqlalchemy.dialects.sqlite",
]

# Heavy / binary packages need collect_all so .so/.pyd land in the bundle.
for pkg in (
    "uvicorn",
    "fastapi",
    "starlette",
    "alembic",
    "pydantic",
    "reportlab",
    "pandas",
    "numpy",
    "openpyxl",
    "PIL",
    "bcrypt",
    "jwt",
    "multipart",
    "sqlalchemy",
):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden
    except Exception:
        try:
            hiddenimports += collect_submodules(pkg)
        except Exception:
            pass

hiddenimports += [
    "numpy",
    "numpy._core",
    "numpy._core._exceptions",
    "numpy.core",
    "pandas._libs",
    "_cffi_backend",
]

a = Analysis(
    [str(BACKEND / "sidecar.py")],
    pathex=[str(BACKEND)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="invoice-maker-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # keep console logs for health/debug; Electron hides the window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="invoice-maker-backend",
)
