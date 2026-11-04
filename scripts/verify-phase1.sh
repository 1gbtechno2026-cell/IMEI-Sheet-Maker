#!/usr/bin/env bash
# Local verification of Phase 1 without Electron GUI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

PORT="${PORT:-8765}"
./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/tmp/im-health.json; then
    echo "HEALTH OK:"
    cat /tmp/im-health.json
    echo
    DB_PATH=$(./.venv/bin/python -c "from app.paths import get_db_path; print(get_db_path())")
    if [[ -f "$DB_PATH" ]]; then
      echo "DB FILE OK: $DB_PATH"
    else
      echo "DB FILE MISSING: $DB_PATH" >&2
      exit 1
    fi
    exit 0
  fi
  sleep 0.25
done

echo "Health check failed" >&2
exit 1
