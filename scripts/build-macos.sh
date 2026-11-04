#!/usr/bin/env bash
# Orchestrator: PyInstaller mac backend → frontend+electron → dmg/zip
# MUST run on a Mac. Does not build Windows NSIS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: build-macos.sh must run on macOS." >&2
  echo "  On Linux you can still: npm run build:frontend && npm run build:electron" >&2
  echo "  and validate electron-builder.yml — but dmg/zip + Mac sidecar need a Mac." >&2
  exit 1
fi

ARCH="$(uname -m)"
echo "========================================"
echo " Invoice Maker — macOS build ($ARCH)"
echo "========================================"

bash "$ROOT/scripts/build-backend-macos.sh"

echo "==> Frontend + Electron main..."
npm install
npm run build:electron
npm run build:frontend

test -f frontend/dist/index.html
test -f dist-electron/main.js
test -f backend/dist/invoice-maker-backend/invoice-maker-backend

echo "==> electron-builder --mac (dmg + zip)..."
# Build for the current machine arch by default (faster). Pass ELECTRON_BUILDER_ARCH=all for both.
if [[ "${ELECTRON_BUILDER_ARCH:-current}" == "all" ]]; then
  npx electron-builder --mac dmg zip --config electron-builder.yml
else
  if [[ "$ARCH" == "arm64" ]]; then
    npx electron-builder --mac dmg zip --arm64 --config electron-builder.yml
  else
    npx electron-builder --mac dmg zip --x64 --config electron-builder.yml
  fi
fi

echo ""
echo "Artifacts under: $ROOT/release"
ls -la "$ROOT/release" || true
echo ""
echo "NOTE: App data stays in ~/Library/Application Support/InvoiceMaker/"
echo "After Settings → Restore, quit and relaunch the app."
echo "Gatekeeper: unsigned builds may need right-click → Open the first time."
