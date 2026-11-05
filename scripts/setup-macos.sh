#!/usr/bin/env bash
# macOS development setup — Node + Python 3.11 venv + Alembic
# Run on a Mac. Prefer Homebrew python@3.11.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> IMEI Data Maker macOS setup"
echo "    App data → ~/Library/Application Support/InvoiceMaker/"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found. Install Node 20+ (https://nodejs.org or: brew install node)" >&2
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "WARN: Node $(node -v) detected; Node 20+ recommended."
fi

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  for c in /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11 python3.11; do
    if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then
      PYTHON_BIN="$c"
      break
    fi
  done
fi
if [[ -z "${PYTHON_BIN:-}" ]]; then
  echo "ERROR: Python 3.11 not found." >&2
  echo "  brew install python@3.11" >&2
  echo "  Or: PYTHON_BIN=/path/to/python3.11 ./scripts/setup-macos.sh" >&2
  exit 1
fi

PY_VER="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
echo "==> Using Python $PY_VER ($PYTHON_BIN)"
if [[ "$PY_VER" != "3.11" ]]; then
  echo "WARN: Prefer Python 3.11 for packaging parity (got $PY_VER)."
fi

echo "==> npm install (root + frontend)..."
npm install
npm install --prefix frontend

echo "==> Creating backend/.venv..."
cd "$ROOT/backend"
"$PYTHON_BIN" -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt

echo "==> Alembic upgrade head..."
./.venv/bin/python -m alembic upgrade head

DATA_DIR="$HOME/Library/Application Support/InvoiceMaker"
echo ""
echo "Setup complete."
echo "  DB / data: $DATA_DIR"
echo "  Dev:       cd \"$ROOT\" && npm run dev"
echo "  Seed:      ./scripts/seed-phase4.sh"
echo "  Backend:   npm run dev:backend:posix"
