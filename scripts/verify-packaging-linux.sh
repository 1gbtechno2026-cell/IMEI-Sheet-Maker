#!/usr/bin/env bash
# Linux/cloud sanity checks for Phase 8 packaging configs.
# Does NOT produce a Windows NSIS installer.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Frontend production build"
npm --prefix frontend run build
test -f frontend/dist/index.html

echo "==> Electron TypeScript compile"
npm run build:electron
test -f dist-electron/main.js

echo "==> electron-builder config present (win + mac)"
test -f electron-builder.yml
grep -q 'deleteAppDataOnUninstall: false' electron-builder.yml
grep -q 'productName: Invoice Maker' electron-builder.yml
grep -q 'invoice-maker-backend' electron-builder.yml
grep -q 'target: dmg' electron-builder.yml
grep -q 'target: nsis' electron-builder.yml

echo "==> PyInstaller spec + sidecar + dual-platform scripts"
test -f backend/sidecar.py
test -f backend/invoice-maker-backend.spec
test -f backend/app/migrate.py
test -f scripts/build-backend.ps1
test -f scripts/build-frontend.ps1
test -f scripts/build-installer.ps1
test -f scripts/build-all.ps1
test -f scripts/setup-macos.sh
test -f scripts/build-macos.sh
test -f scripts/build-backend-macos.sh
test -f scripts/seed-phase4.sh

echo "==> macOS path helper (simulated via INVOICE_MAKER_DATA_DIR)"
cd backend
TMPDATA="$(mktemp -d)/Library/Application Support/InvoiceMaker"
INVOICE_MAKER_DATA_DIR="$TMPDATA" .venv/bin/python - <<'PY'
import os
from pathlib import Path
from app.paths import get_app_data_dir, ensure_app_subdirs, get_db_path
root = get_app_data_dir()
assert "Application Support" in str(root) or root == Path(os.environ["INVOICE_MAKER_DATA_DIR"]).resolve()
ensure_app_subdirs()
assert get_db_path().name == "app.db"
print("path helper OK:", root)
PY
cd "$ROOT"

echo "==> Alembic upgrade via app.migrate (dev path)"
cd backend
.venv/bin/python -c "from app.migrate import run_alembic_upgrade; run_alembic_upgrade(); print('migrate OK')"

echo "==> Optional: PyInstaller onedir on Linux (binary name without .exe)"
if .venv/bin/python -c "import PyInstaller" 2>/dev/null; then
  .venv/bin/python -m PyInstaller --noconfirm invoice-maker-backend.spec || {
    echo "WARN: PyInstaller Linux build failed (acceptable on this VM); Windows build is authoritative."
  }
else
  echo "SKIP: PyInstaller not installed in venv (install requirements-build.txt to smoke Linux binary)."
fi

echo ""
echo "Linux packaging sanity OK."
echo "Windows NSIS/.exe  → build on Windows + Python 3.11 (docs/phase-8-runbook.md)"
echo "macOS dmg/zip      → build on a Mac (docs/macos-runbook.md); cannot cross-build from Linux"
