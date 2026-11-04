"""Dashboard aggregate metrics."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Company, Invoice, InvoiceItem


def _month_start(today: date) -> date:
    return today.replace(day=1)


def get_dashboard(db: Session) -> dict:
    today = date.today()
    month_start = _month_start(today)

    invoices_today = db.scalar(
        select(func.count()).select_from(Invoice).where(
            Invoice.is_deleted.is_(False), Invoice.invoice_date == today
        )
    ) or 0
    invoices_month = db.scalar(
        select(func.count()).select_from(Invoice).where(
            Invoice.is_deleted.is_(False),
            Invoice.invoice_date >= month_start,
            Invoice.invoice_date <= today,
        )
    ) or 0

    units_total = db.scalar(
        select(func.count())
        .select_from(InvoiceItem)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.is_deleted.is_(False))
    ) or 0
    units_month = db.scalar(
        select(func.count())
        .select_from(InvoiceItem)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(
            Invoice.is_deleted.is_(False),
            Invoice.invoice_date >= month_start,
            Invoice.invoice_date <= today,
        )
    ) or 0

    local_count = db.scalar(
        select(func.count()).select_from(Invoice).where(
            Invoice.is_deleted.is_(False), Invoice.invoice_type == "LOCAL"
        )
    ) or 0
    intl_count = db.scalar(
        select(func.count()).select_from(Invoice).where(
            Invoice.is_deleted.is_(False), Invoice.invoice_type == "INTERNATIONAL"
        )
    ) or 0

    # Top buyers by invoice count
    buyer_rows = db.execute(
        select(Invoice.buyer_id, func.count())
        .where(Invoice.is_deleted.is_(False))
        .group_by(Invoice.buyer_id)
        .order_by(func.count().desc())
        .limit(5)
    ).all()
    top_buyers = []
    for buyer_id, cnt in buyer_rows:
        company = db.get(Company, buyer_id)
        top_buyers.append(
            {
                "buyer_id": buyer_id,
                "buyer_name": company.name if company else f"#{buyer_id}",
                "invoice_count": int(cnt),
            }
        )

    recent = db.scalars(
        select(Invoice)
        .where(Invoice.is_deleted.is_(False))
        .options(selectinload(Invoice.seller), selectinload(Invoice.buyer), selectinload(Invoice.items))
        .order_by(Invoice.id.desc())
        .limit(10)
    ).all()
    recent_out = [
        {
            "id": inv.id,
            "invoice_no": inv.invoice_no,
            "invoice_type": inv.invoice_type,
            "invoice_date": inv.invoice_date.isoformat(),
            "status": inv.status,
            "seller_name": inv.seller.name if inv.seller else None,
            "buyer_name": inv.buyer.name if inv.buyer else None,
            "item_count": len(inv.items),
        }
        for inv in recent
    ]

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "invoices_today": int(invoices_today),
        "invoices_month": int(invoices_month),
        "units_total": int(units_total),
        "units_month": int(units_month),
        "split": {
            "LOCAL": int(local_count),
            "INTERNATIONAL": int(intl_count),
        },
        "top_buyers": top_buyers,
        "recent_invoices": recent_out,
    }
