"""Financial year and invoice number preview / reservation."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Company, InvoiceSequence
from app.services.settings_service import get_fy_start_month


def financial_year_label(invoice_date: date, fy_start_month: int = 4) -> str:
    """Return e.g. 2026-27 for April–March FY containing invoice_date."""
    if invoice_date.month >= fy_start_month:
        start_year = invoice_date.year
    else:
        start_year = invoice_date.year - 1
    end_yy = str(start_year + 1)[-2:]
    return f"{start_year}-{end_yy}"


def type_code(invoice_type: str) -> str:
    return "INT" if invoice_type == "INTERNATIONAL" else "LOC"


def format_invoice_no(prefix: str, invoice_type: str, fy: str, number: int) -> str:
    clean_prefix = (prefix or "INV").strip() or "INV"
    return f"{clean_prefix}/{type_code(invoice_type)}/{fy}/{number:04d}"


def peek_next_number(
    db: Session,
    *,
    seller: Company,
    invoice_type: str,
    invoice_date: date,
) -> dict:
    fy_start = get_fy_start_month(db)
    fy = financial_year_label(invoice_date, fy_start)
    seq = db.scalar(
        select(InvoiceSequence).where(
            InvoiceSequence.seller_company_id == seller.id,
            InvoiceSequence.invoice_type == invoice_type,
            InvoiceSequence.financial_year == fy,
        )
    )
    next_num = (seq.last_number if seq else 0) + 1
    prefix = seller.invoice_prefix or "INV"
    invoice_no = format_invoice_no(prefix, invoice_type, fy, next_num)
    return {
        "invoice_no": invoice_no,
        "financial_year": fy,
        "next_number": next_num,
        "fy_start_month": fy_start,
        "reserved": False,
        "prefix": prefix,
        "type_code": type_code(invoice_type),
    }


def reserve_next_number(
    db: Session,
    *,
    seller: Company,
    invoice_type: str,
    invoice_date: date,
) -> dict:
    """Increment sequence inside the caller's transaction and return the reserved number."""
    fy_start = get_fy_start_month(db)
    fy = financial_year_label(invoice_date, fy_start)
    seq = db.scalar(
        select(InvoiceSequence)
        .where(
            InvoiceSequence.seller_company_id == seller.id,
            InvoiceSequence.invoice_type == invoice_type,
            InvoiceSequence.financial_year == fy,
        )
        .with_for_update()
    )
    if seq is None:
        seq = InvoiceSequence(
            seller_company_id=seller.id,
            invoice_type=invoice_type,
            financial_year=fy,
            last_number=0,
        )
        db.add(seq)
        db.flush()

    seq.last_number += 1
    db.add(seq)
    db.flush()

    prefix = seller.invoice_prefix or "INV"
    invoice_no = format_invoice_no(prefix, invoice_type, fy, seq.last_number)
    return {
        "invoice_no": invoice_no,
        "financial_year": fy,
        "next_number": seq.last_number,
        "fy_start_month": fy_start,
        "reserved": True,
        "prefix": prefix,
        "type_code": type_code(invoice_type),
    }
