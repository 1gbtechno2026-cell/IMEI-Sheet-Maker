#!/usr/bin/env bash
# Seed sample companies + Excel (POSIX: macOS / Linux)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/backend/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "ERROR: Missing backend/.venv. Run ./scripts/setup-macos.sh (Mac) or setup-posix.sh (Linux)." >&2
  exit 1
fi
exec "$PY" "$ROOT/scripts/seed_phase4.py"
