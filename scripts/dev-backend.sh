#!/usr/bin/env bash
# Run FastAPI alone on :8000 (macOS / Linux)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
if [[ ! -x ./.venv/bin/python ]]; then
  echo "ERROR: Missing .venv. Run setup-macos.sh or setup-posix.sh first." >&2
  exit 1
fi
exec ./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
