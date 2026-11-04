"""Seed 2 sample companies + Local/International Excel samples for Phase 4 testing."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from openpyxl import Workbook  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Company  # noqa: E402
from app.services import auth_service  # noqa: E402
from app.services.imei import luhn_ok  # noqa: E402
from app.services.settings_service import ensure_default_settings  # noqa: E402
from app.paths import ensure_app_subdirs  # noqa: E402


def make_valid_imei(prefix14: str) -> str:
    """Build a Luhn-valid 15-digit IMEI from a 14-digit body."""
    body = "".join(ch for ch in prefix14 if ch.isdigit())[:14].ljust(14, "0")
    for check in range(10):
        candidate = body + str(check)
        if luhn_ok(candidate):
            return candidate
    raise RuntimeError("Could not compute Luhn digit")


def write_excel(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.append(headers)
    for row in rows:
        ws.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def main() -> None:
    ensure_app_subdirs()
    samples = BACKEND.parent / "sample-data"
    samples.mkdir(exist_ok=True)

    db = SessionLocal()
    try:
        auth_service.ensure_default_admin(db)
        ensure_default_settings(db)

        sellers = {
            "Acme Electronics Pvt Ltd": {
                "address": "12 MG Road, Bengaluru",
                "gstin": "29AAAAA0000A1Z5",
                "pan": "AAAAA0000A",
                "state": "Karnataka",
                "country": "India",
                "phone": "+91-9876500001",
                "email": "seller@acme.example",
                "can_be_seller": True,
                "can_be_buyer": True,
                "invoice_prefix": "ACME",
            },
            "Beta Traders LLC": {
                "address": "88 Market St, Dubai",
                "gstin": None,
                "pan": None,
                "state": "Dubai",
                "country": "UAE",
                "phone": "+971-500000002",
                "email": "buyer@beta.example",
                "can_be_seller": True,
                "can_be_buyer": True,
                "invoice_prefix": "BETA",
            },
        }

        for name, fields in sellers.items():
            existing = db.scalar(select(Company).where(Company.name == name))
            if existing:
                print(f"company exists: {name} id={existing.id}")
                continue
            company = Company(name=name, is_active=True, **fields)
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f"created company: {name} id={company.id}")

        # Sample rows
        local_rows = []
        intl_rows = []
        models = ["A14-128", "A14-128", "S24-256", "S24-256", "X200-512"]
        for i, model in enumerate(models):
            imei = make_valid_imei(f"35693803{100000 + i}")
            local_rows.append([model, imei])
            intl_rows.append([model, imei, f"BOX-{(i // 2) + 1:03d}"])

        # Add one intentionally invalid row in a separate "bad" file for testing
        bad_rows = list(local_rows) + [["", "123"], ["A14-128", local_rows[0][1]]]

        local_path = samples / "sample_local.xlsx"
        intl_path = samples / "sample_international.xlsx"
        bad_path = samples / "sample_local_with_errors.xlsx"
        write_excel(local_path, ["Model No", "IMEI"], local_rows)
        write_excel(intl_path, ["Model No", "IMEI", "Box No"], intl_rows)
        write_excel(bad_path, ["Model No", "IMEI"], bad_rows)

        print(f"wrote {local_path}")
        print(f"wrote {intl_path}")
        print(f"wrote {bad_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
