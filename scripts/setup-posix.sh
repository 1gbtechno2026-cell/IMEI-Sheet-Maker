#!/usr/bin/env bash
# Dev/cloud setup on Linux/macOS (Python 3.11 preferred; 3.12 OK for Phase 1 verify)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing root npm packages..."
npm install

echo "==> Installing frontend npm packages..."
npm install --prefix frontend

echo "==> Creating Python venv in backend/..."
cd "$ROOT/backend"
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN=python3.11
  else
    PYTHON_BIN=python3
  fi
fi
"$PYTHON_BIN" -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m alembic upgrade head

case "$(uname -s)" in
  Darwin)
    echo "Setup complete. DB: ~/Library/Application Support/InvoiceMaker/app.db (macOS)"
    echo "Prefer ./scripts/setup-macos.sh on Mac (checks Homebrew Python 3.11)."
    ;;
  *)
    echo "Setup complete. DB: ~/.local/share/InvoiceMaker/app.db (Linux)"
    ;;
esac
