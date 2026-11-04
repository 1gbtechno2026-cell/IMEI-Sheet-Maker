"""Row validation for invoice line items."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Invoice, InvoiceItem
from app.services.imei import validate_imei


def find_existing_imeis(
    db: Session,
    imeis: list[str],
    *,
    exclude_invoice_id: int | None = None,
) -> dict[str, str]:
    """Map IMEI -> invoice_no for IMEIs already on a non-deleted invoice."""
    unique = [i for i in set(imeis) if i]
    if not unique:
        return {}
    found: dict[str, str] = {}
    chunk_size = 500
    for i in range(0, len(unique), chunk_size):
        chunk = unique[i : i + chunk_size]
        stmt = (
            select(InvoiceItem.imei, Invoice.invoice_no)
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .where(InvoiceItem.imei.in_(chunk))
            .where(Invoice.is_deleted.is_(False))
        )
        if exclude_invoice_id is not None:
            stmt = stmt.where(Invoice.id != exclude_invoice_id)
        rows = db.execute(stmt).all()
        for imei, invoice_no in rows:
            found[str(imei)] = str(invoice_no)
    return found


def validate_rows(
    db: Session,
    rows: list[dict[str, Any]],
    *,
    invoice_type: str,
    exclude_invoice_id: int | None = None,
) -> dict[str, Any]:
    # First pass: normalize + per-row field errors
    prepared: list[dict[str, Any]] = []
    imei_list: list[str] = []

    for i, raw in enumerate(rows):
        model = str(raw.get("model_no") or "").strip()
        imei_raw = raw.get("imei")
        box = str(raw.get("box_no") or "").strip() or None
        country = str(raw.get("country_of_origin") or "").strip() or None
        errors: list[str] = []

        if invoice_type != "INTERNATIONAL":
            box = None
            country = None

        if not model:
            errors.append("Model No is blank")

        imei, imei_errors = validate_imei(imei_raw)
        errors.extend(imei_errors)

        if invoice_type == "INTERNATIONAL" and not box:
            errors.append("Box No is blank")
        if invoice_type == "INTERNATIONAL" and not country:
            errors.append("Country of Origin is blank")

        prepared.append(
            {
                "row_index": raw.get("row_index", i + 1),
                "model_no": model,
                "imei": imei or str(imei_raw or "").strip(),
                "box_no": box,
                "country_of_origin": country,
                "errors": errors,
                "error_fields": [],
            }
        )
        if imei:
            imei_list.append(imei)

    # Duplicate IMEIs within file
    counts = Counter(imei_list)
    dupes = {imei for imei, n in counts.items() if n > 1}

    # Already on an invoice (optionally excluding the invoice being edited)
    existing = find_existing_imeis(db, imei_list, exclude_invoice_id=exclude_invoice_id)

    for row in prepared:
        fields: list[str] = []
        errs: list[str] = list(row["errors"])
        imei = row["imei"]

        if not row["model_no"]:
            fields.append("model_no")
        if any("IMEI" in e or "Luhn" in e for e in errs):
            fields.append("imei")
        if invoice_type == "INTERNATIONAL" and not row["box_no"]:
            fields.append("box_no")
        if invoice_type == "INTERNATIONAL" and not row["country_of_origin"]:
            fields.append("country_of_origin")

        if imei and imei in dupes:
            errs.append("Duplicate IMEI in this file")
            if "imei" not in fields:
                fields.append("imei")
        if imei and imei in existing:
            errs.append(f"IMEI already on invoice {existing[imei]}")
            if "imei" not in fields:
                fields.append("imei")

        # de-dupe errors preserving order
        seen: set[str] = set()
        uniq_errs: list[str] = []
        for e in errs:
            if e not in seen:
                seen.add(e)
                uniq_errs.append(e)

        row["errors"] = uniq_errs
        row["error_fields"] = fields
        row["ok"] = len(uniq_errs) == 0

    ok_rows = [r for r in prepared if r["ok"]]
    bad_rows = [r for r in prepared if not r["ok"]]

    summary_map: dict[str, int] = defaultdict(int)
    for r in ok_rows:
        summary_map[r["model_no"]] += 1
    summary = [
        {"model_no": model, "quantity": qty}
        for model, qty in sorted(summary_map.items(), key=lambda x: x[0])
    ]

    return {
        "rows": prepared,
        "total": len(prepared),
        "valid_count": len(ok_rows),
        "error_count": len(bad_rows),
        "summary": summary,
        "can_save": len(prepared) > 0 and len(bad_rows) == 0,
    }
