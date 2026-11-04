"""Invoice create / finalize (DRAFT → FINAL with PDF)."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Company, CompanyGst, Invoice, InvoiceItem, User
from app.paths import ensure_app_subdirs
from app.pdf import generate_invoice_pdf
from app.services import invoice_validation


def _safe_filename(invoice_no: str) -> str:
    cleaned = re.sub(r"[^\w.\-]+", "_", invoice_no)
    return cleaned.strip("_") or "invoice"


def _clean_invoice_no(invoice_no: str) -> str:
    cleaned = " ".join(str(invoice_no or "").split())
    if not cleaned:
        raise ValueError("Type the invoice number")
    if len(cleaned) > 100:
        raise ValueError("Invoice number is too long")
    return cleaned


def _ensure_unique_invoice_no(db: Session, invoice_no: str, exclude_id: int | None = None) -> None:
    stmt = select(Invoice.id).where(Invoice.invoice_no == invoice_no)
    if exclude_id is not None:
        stmt = stmt.where(Invoice.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise ValueError(f"Invoice number {invoice_no} is already used")


def _gst_for_company(company: Company, gst_id: int | None, role: str) -> CompanyGst | None:
    rows = list(company.gsts or [])
    if not rows:
        return None
    if gst_id is None:
        if len(rows) == 1:
            return rows[0]
        raise ValueError(f"Select a GST for the {role}")
    match = next((row for row in rows if row.id == gst_id), None)
    if match is None:
        raise ValueError(f"That GST does not belong to the {role}")
    return match


def create_draft(
    db: Session,
    *,
    user: User,
    invoice_no: str,
    invoice_type: str,
    seller_id: int,
    buyer_id: int,
    seller_gst_id: int | None,
    buyer_gst_id: int | None,
    invoice_date: date,
    country_of_origin: str | None,
    currency: str | None,
    notes: str | None,
    source_file_name: str | None,
    rows: list[dict[str, Any]],
) -> Invoice:
    if seller_id == buyer_id:
        raise ValueError("Seller and buyer must be different")

    seller = db.get(Company, seller_id)
    buyer = db.get(Company, buyer_id)
    if seller is None or not seller.is_active or not seller.can_be_seller:
        raise ValueError("Invalid seller company")
    if buyer is None or not buyer.is_active or not buyer.can_be_buyer:
        raise ValueError("Invalid buyer company")

    number = _clean_invoice_no(invoice_no)
    _ensure_unique_invoice_no(db, number)
    seller_gst = _gst_for_company(seller, seller_gst_id, "seller")
    buyer_gst = _gst_for_company(buyer, buyer_gst_id, "buyer")

    validation = invoice_validation.validate_rows(db, rows, invoice_type=invoice_type)
    if not validation["can_save"]:
        raise ValueError(
            f"Cannot save: {validation['error_count']} row(s) have validation errors"
        )

    invoice = Invoice(
        invoice_no=number,
        invoice_type=invoice_type,
        seller_id=seller.id,
        buyer_id=buyer.id,
        seller_gst_id=seller_gst.id if seller_gst else None,
        buyer_gst_id=buyer_gst.id if buyer_gst else None,
        invoice_date=invoice_date,
        country_of_origin=(country_of_origin or "").strip() or None,
        currency=None,
        status="DRAFT",
        pdf_path=None,
        source_file_name=source_file_name,
        notes=None,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(invoice)
    db.flush()

    # Bulk insert items
    items = [
        InvoiceItem(
            invoice_id=invoice.id,
            model_no=r["model_no"],
            imei=r["imei"],
            box_no=(str(r.get("box_no") or "").strip() or None),
            country_of_origin=(str(r.get("country_of_origin") or "").strip() or None),
            rate=None,
        )
        for r in validation["rows"]
    ]
    db.bulk_save_objects(items)
    db.commit()
    db.refresh(invoice)
    # Attach summary from validation for response (avoid lazy-load after bulk insert)
    invoice._phase4_summary = validation["summary"]  # type: ignore[attr-defined]
    invoice._phase4_item_count = validation["valid_count"]  # type: ignore[attr-defined]
    return invoice


def get_invoice(db: Session, invoice_id: int) -> Invoice | None:
    return db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.seller).selectinload(Company.gsts),
            selectinload(Invoice.buyer).selectinload(Company.gsts),
            selectinload(Invoice.seller_gst),
            selectinload(Invoice.buyer_gst),
        )
    )


def list_invoices(
    db: Session,
    *,
    created_by: int | None = None,
    invoice_type: str | None = None,
    status: str | None = None,
    seller_id: int | None = None,
    buyer_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    invoice_no: str | None = None,
    imei: str | None = None,
    include_deleted: bool = False,
    limit: int = 500,
) -> list[Invoice]:
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.seller).selectinload(Company.gsts),
            selectinload(Invoice.buyer).selectinload(Company.gsts),
            selectinload(Invoice.seller_gst),
            selectinload(Invoice.buyer_gst),
        )
        .order_by(Invoice.id.desc())
    )
    if not include_deleted:
        stmt = stmt.where(Invoice.is_deleted.is_(False))
    if created_by is not None:
        stmt = stmt.where(Invoice.created_by == created_by)
    if invoice_type:
        stmt = stmt.where(Invoice.invoice_type == invoice_type)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if seller_id is not None:
        stmt = stmt.where(Invoice.seller_id == seller_id)
    if buyer_id is not None:
        stmt = stmt.where(Invoice.buyer_id == buyer_id)
    if date_from is not None:
        stmt = stmt.where(Invoice.invoice_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Invoice.invoice_date <= date_to)
    if invoice_no:
        like = f"%{invoice_no.strip()}%"
        stmt = stmt.where(Invoice.invoice_no.ilike(like))
    if imei:
        needle = "".join(ch for ch in imei if ch.isdigit()) or imei.strip()
        stmt = (
            stmt.join(InvoiceItem, InvoiceItem.invoice_id == Invoice.id)
            .where(InvoiceItem.imei.ilike(f"%{needle}%"))
            .distinct()
        )
    stmt = stmt.limit(limit)
    return list(db.scalars(stmt).all())


def snapshot_invoice(invoice: Invoice) -> dict[str, Any]:
    items = [
        {
            "model_no": it.model_no,
            "imei": it.imei,
            "box_no": it.box_no,
            "rate": it.rate,
        }
        for it in invoice.items
    ]
    return {
        "id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "invoice_type": invoice.invoice_type,
        "seller_id": invoice.seller_id,
        "buyer_id": invoice.buyer_id,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "country_of_origin": invoice.country_of_origin,
        "currency": invoice.currency,
        "status": invoice.status,
        "notes": invoice.notes,
        "source_file_name": invoice.source_file_name,
        "is_deleted": invoice.is_deleted,
        "items": items,
    }


def update_invoice(
    db: Session,
    *,
    invoice: Invoice,
    user: User,
    invoice_no: str | None,
    buyer_id: int,
    seller_gst_id: int | None,
    buyer_gst_id: int | None,
    invoice_date: date,
    country_of_origin: str | None,
    currency: str | None,
    notes: str | None,
    source_file_name: str | None,
    rows: list[dict[str, Any]],
    regenerate_pdf: bool = True,
) -> Invoice:
    """Edit invoice fields/items; keep invoice_no; audit before/after; optionally regenerate PDF."""
    from app.services import audit as audit_service

    full = get_invoice(db, invoice.id)
    if full is None or full.is_deleted:
        raise ValueError("Invoice not found")
    invoice = full

    if buyer_id == invoice.seller_id:
        raise ValueError("Seller and buyer must be different")
    buyer = db.get(Company, buyer_id)
    if buyer is None or not buyer.is_active or not buyer.can_be_buyer:
        raise ValueError("Invalid buyer company")

    before = snapshot_invoice(invoice)

    if invoice_no is not None:
        number = _clean_invoice_no(invoice_no)
        _ensure_unique_invoice_no(db, number, exclude_id=invoice.id)
        invoice.invoice_no = number
    seller_gst = _gst_for_company(invoice.seller, seller_gst_id, "seller")
    buyer_gst = _gst_for_company(buyer, buyer_gst_id, "buyer")

    validation = invoice_validation.validate_rows(
        db,
        rows,
        invoice_type=invoice.invoice_type,
        exclude_invoice_id=invoice.id,
    )
    if not validation["can_save"]:
        raise ValueError(
            f"Cannot save: {validation['error_count']} row(s) have validation errors"
        )

    invoice.buyer_id = buyer.id
    invoice.seller_gst_id = seller_gst.id if seller_gst else None
    invoice.buyer_gst_id = buyer_gst.id if buyer_gst else None
    invoice.invoice_date = invoice_date
    invoice.country_of_origin = None
    invoice.currency = None
    invoice.notes = None
    if source_file_name is not None:
        invoice.source_file_name = source_file_name
    invoice.updated_by = user.id

    # Replace line items
    for old in list(invoice.items):
        db.delete(old)
    db.flush()
    for r in validation["rows"]:
        db.add(
            InvoiceItem(
                invoice_id=invoice.id,
                model_no=r["model_no"],
                imei=r["imei"],
                box_no=(str(r.get("box_no") or "").strip() or None),
                country_of_origin=(str(r.get("country_of_origin") or "").strip() or None),
                rate=None,
            )
        )
    db.flush()

    after_pre_pdf = snapshot_invoice(invoice)
    audit_service.write_audit(
        db,
        user=user,
        action="invoice.update",
        entity="invoice",
        entity_id=invoice.id,
        before=before,
        after=after_pre_pdf,
    )
    db.commit()

    if regenerate_pdf:
        invoice = render_and_finalize(db, invoice=invoice, user=user, mark_final=True)
    else:
        db.refresh(invoice)
    return get_invoice(db, invoice.id) or invoice


def soft_delete_invoice(db: Session, *, invoice: Invoice, user: User) -> Invoice:
    from app.services import audit as audit_service

    full = get_invoice(db, invoice.id)
    if full is None:
        raise ValueError("Invoice not found")
    invoice = full
    before = snapshot_invoice(invoice)
    invoice.is_deleted = True
    invoice.updated_by = user.id
    after = snapshot_invoice(invoice)
    audit_service.write_audit(
        db,
        user=user,
        action="invoice.soft_delete",
        entity="invoice",
        entity_id=invoice.id,
        before=before,
        after=after,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def render_and_finalize(
    db: Session,
    *,
    invoice: Invoice,
    user: User,
    mark_final: bool = True,
) -> Invoice:
    """Generate PDF under app-data/invoices, optionally set status FINAL."""
    # Ensure relationships loaded
    full = get_invoice(db, invoice.id)
    if full is None:
        raise ValueError("Invoice not found")
    invoice = full
    if not invoice.items:
        raise ValueError("Invoice has no line items")
    seller = invoice.seller
    buyer = invoice.buyer
    if seller is None or buyer is None:
        raise ValueError("Invoice parties missing")

    dirs = ensure_app_subdirs()
    filename = f"{_safe_filename(invoice.invoice_no)}.pdf"
    output_path = dirs["invoices"] / filename

    # Replace previous PDF if regenerating
    if invoice.pdf_path and invoice.pdf_path != str(output_path):
        old = Path(invoice.pdf_path)
        try:
            if old.is_file():
                old.unlink()
        except OSError:
            pass

    from app.services.settings_service import get_pdf_footer

    footer = get_pdf_footer(db)
    generate_invoice_pdf(
        invoice=invoice,
        seller=seller,
        buyer=buyer,
        items=list(invoice.items),
        output_path=output_path,
        footer_text=footer,
    )


    invoice.pdf_path = str(output_path)
    if mark_final:
        invoice.status = "FINAL"
    invoice.updated_by = user.id
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def invoice_to_out(invoice: Invoice, item_count: int | None = None, summary: list | None = None) -> dict:
    if summary is None:
        summary = getattr(invoice, "_phase4_summary", None)
    if item_count is None:
        item_count = getattr(invoice, "_phase4_item_count", None)
    if summary is None or item_count is None:
        counts: dict[str, int] = defaultdict(int)
        for item in invoice.items:
            counts[item.model_no] += 1
        summary = [{"model_no": m, "quantity": q} for m, q in sorted(counts.items())]
        item_count = sum(counts.values())
    seller_name = invoice.seller.name if getattr(invoice, "seller", None) else None
    buyer_name = invoice.buyer.name if getattr(invoice, "buyer", None) else None

    def _gst_rows(company: Company | None) -> list[dict[str, Any]]:
        if company is None:
            return []
        return [
            {"id": row.id, "label": row.label, "state": row.state, "gstin": row.gstin}
            for row in (company.gsts or [])
        ]

    return {
        "id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "invoice_type": invoice.invoice_type,
        "seller_id": invoice.seller_id,
        "buyer_id": invoice.buyer_id,
        "seller_name": seller_name,
        "buyer_name": buyer_name,
        "seller_gst_id": invoice.seller_gst_id,
        "buyer_gst_id": invoice.buyer_gst_id,
        "seller_gsts": _gst_rows(getattr(invoice, "seller", None)),
        "buyer_gsts": _gst_rows(getattr(invoice, "buyer", None)),
        "invoice_date": invoice.invoice_date,
        "country_of_origin": invoice.country_of_origin,
        "currency": invoice.currency,
        "status": invoice.status,
        "pdf_path": invoice.pdf_path,
        "source_file_name": invoice.source_file_name,
        "notes": invoice.notes,
        "is_deleted": bool(getattr(invoice, "is_deleted", False)),
        "created_by": invoice.created_by,
        "item_count": item_count,
        "summary": summary,
        "items": [
            {
                "id": it.id,
                "model_no": it.model_no,
                "imei": it.imei,
                "box_no": it.box_no,
                "country_of_origin": it.country_of_origin,
                "rate": it.rate,
            }
            for it in (invoice.items or [])
        ],
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }
