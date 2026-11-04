#!/usr/bin/env bash
# Build FastAPI sidecar with PyInstaller on macOS → backend/dist/invoice-maker-backend/
# MUST run on a Mac (PyInstaller cannot cross-compile macOS binaries from Linux).
# Prefer Python 3.11.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
cd "$BACKEND"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: build-backend-macos.sh must run on macOS (uname=$(uname -s))." >&2
  echo "  This Linux/cloud host cannot produce a Mac PyInstaller binary." >&2
  exit 1
fi

if [[ ! -x ./.venv/bin/python ]]; then
  echo "ERROR: Missing backend/.venv. Run ./scripts/setup-macos.sh first." >&2
  exit 1
fi

PY_VER="$(./.venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
echo "==> Python $PY_VER — installing build deps..."
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements-build.txt

echo "==> Cleaning previous PyInstaller output..."
rm -rf ./build/invoice-maker-backend ./dist/invoice-maker-backend

echo "==> PyInstaller onedir..."
./.venv/bin/python -m PyInstaller --noconfirm ./invoice-maker-backend.spec

EXE="$BACKEND/dist/invoice-maker-backend/invoice-maker-backend"
if [[ ! -f "$EXE" ]]; then
  echo "ERROR: Expected binary missing: $EXE" >&2
  exit 1
fi
chmod +x "$EXE"

echo ""
echo "Backend build OK: $EXE"
echo "Smoke:"
echo "  \"$EXE\" --host 127.0.0.1 --port 8765"
echo "  curl -s http://127.0.0.1:8765/health"
echo "Data dir: ~/Library/Application Support/InvoiceMaker/"
