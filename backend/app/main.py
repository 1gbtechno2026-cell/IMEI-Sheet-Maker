"""FastAPI entrypoint for Invoice Maker sidecar."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal
from app.paths import ensure_app_subdirs, get_app_data_dir, get_db_path
from app.routers import access, auth, companies, dashboard, health, invoices, settings, users
from app.security import get_jwt_secret
from app.services import auth_service
from app.services.backup_service import auto_backup_on_start
from app.services.settings_service import ensure_default_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_app_subdirs()
    # Safe for both `uvicorn app.main:app` (dev) and packaged sidecar (also runs
    # migrations in sidecar.py before import — second call is a no-op at head).
    from app.migrate import run_alembic_upgrade

    run_alembic_upgrade()
    get_jwt_secret()
    db = SessionLocal()
    try:
        auth_service.ensure_default_admin(db)
        ensure_default_settings(db)
    finally:
        db.close()
    auto_backup_on_start()
    yield


app = FastAPI(
    title="Invoice Maker API",
    version="0.9.0",
    description="Local sidecar API for Invoice Maker (offline desktop app).",
    lifespan=lifespan,
)

# Local Electron renderer only — no external hosts.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(access.router)
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(invoices.router)
app.include_router(dashboard.router)
app.include_router(settings.router)


@app.get("/")
def root() -> dict:
    return {
        "name": "Invoice Maker API",
        "version": "0.9.0",
        "app_data_dir": str(get_app_data_dir()),
        "db_path": str(get_db_path()),
    }
