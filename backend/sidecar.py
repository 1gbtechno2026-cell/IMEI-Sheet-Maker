"""Packaged FastAPI sidecar entrypoint.

Used by PyInstaller as the console script for invoice-maker-backend.exe.
Runs Alembic upgrade head, then serves uvicorn on 127.0.0.1.

Usage:
  invoice-maker-backend.exe --host 127.0.0.1 --port 12345
"""

from __future__ import annotations

import argparse
import logging
import sys


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        stream=sys.stderr,
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Invoice Maker FastAPI sidecar")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default 127.0.0.1)")
    parser.add_argument("--port", type=int, required=True, help="Bind port")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    _configure_logging()
    args = parse_args(argv)
    log = logging.getLogger("invoice_maker.sidecar")

    # Migrations before importing the FastAPI app (engine created on import).
    from app.migrate import run_alembic_upgrade

    try:
        run_alembic_upgrade()
    except Exception:
        log.exception("Alembic upgrade failed")
        return 1

    import uvicorn

    log.info("Starting uvicorn on %s:%s", args.host, args.port)
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
        # Single worker — local desktop sidecar only.
        workers=1,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
