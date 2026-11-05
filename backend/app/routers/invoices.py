"""Invoicing API — parse/validate, DRAFT save, PDF finalize."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response

from app.deps import CurrentUser, DbSession, require_permission
from app.models import Company, User
from app.rbac import role_allowed
from app.schemas.invoices import (
    DataTemplateIn,
    DraftInvoiceIn,
    InvoiceListOut,
    InvoiceOut,
    NumberPreviewOut,
    ParseUploadOut,
    UpdateInvoiceIn,
    ValidateRowsIn,
    ValidateRowsOut,
)
from app.services import excel_import, invoice_numbers, invoice_validation, invoices as invoice_service
from app.services.excel_export import build_data_template, build_invoice_excel
from app.services.invoice_access import can_delete_invoice, can_edit_invoice, can_view_invoice
from app.services.settings_service import get_default_currency

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("/meta")
def invoice_meta(db: DbSession, _user: User = Depends(require_permission("invoicing"))) -> dict:
    return {
        "default_currency": get_default_currency(db),
        "fy_note": "April–March by default (settings key fy_start_month)",
    }


@router.get("/parties")
def list_parties(
    db: DbSession,
    _user: User = Depends(require_permission("invoicing")),
    role: str = Query(..., pattern="^(seller|buyer)$"),
    q: str | None = Query(default=None),
) -> dict:
    """Active companies for seller/buyer pickers (invoicing permission)."""
    from app.services import companies as company_service

    rows = company_service.list_companies(
        db,
        q=q,
        include_inactive=False,
        can_be_seller=True if role == "seller" else None,
        can_be_buyer=True if role == "buyer" else None,
    )
    return {
        "companies": [company_service.to_out(c) for c in rows],
        "total": len(rows),
    }


@router.get("/preview-number", response_model=NumberPreviewOut)
def preview_number(
    db: DbSession,
    seller_id: int = Query(...),
    invoice_type: str = Query(..., pattern="^(LOCAL|INTERNATIONAL)$"),
    invoice_date: date = Query(default_factory=date.today),
    _user: User = Depends(require_permission("invoicing")),
) -> NumberPreviewOut:
    seller = db.get(Company, seller_id)
    if seller is None or not seller.is_active:
        raise HTTPException(status_code=404, detail="Seller not found")
    data = invoice_numbers.peek_next_number(
        db, seller=seller, invoice_type=invoice_type, invoice_date=invoice_date
    )
    return NumberPreviewOut(**data)


@router.post("/data-template")
def data_template(
    body: DataTemplateIn,
    _user: User = Depends(require_permission("invoicing")),
) -> Response:
    """Step 3: blank IMEI data sheet with the summary filled in."""
    keys = [(m.model_no.strip().upper(), (m.color or "").strip().upper()) for m in body.models]
    if len(set(keys)) != len(keys):
        raise HTTPException(status_code=400, detail="Each model and colour can appear only once")
    payload = build_data_template(
        invoice_type=body.invoice_type,
        seller_name=body.seller_name,
        buyer_name=body.buyer_name,
        invoice_no=body.invoice_no,
        invoice_date=body.invoice_date,
        models=[m.model_dump() for m in body.models],
    )
    stem = invoice_service._safe_filename(body.invoice_no) if body.invoice_no.strip() else "imei-data"
    return Response(
        content=payload,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{stem}-template.xlsx"'},
    )


@router.post("/parse-upload", response_model=ParseUploadOut)
async def parse_upload(
    db: DbSession,
    _user: User = Depends(require_permission("invoicing")),
    invoice_type: str = Form(...),
    column_map: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> ParseUploadOut:
    if invoice_type not in {"LOCAL", "INTERNATIONAL"}:
        raise HTTPException(status_code=400, detail="invoice_type must be LOCAL or INTERNATIONAL")
    raw_map = None
    if column_map:
        try:
            raw_map = json.loads(column_map)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="column_map must be JSON") from exc

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 40 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 40MB)")

    try:
        parsed = excel_import.parse_rows(
            data,
            file.filename or "upload.xlsx",
            invoice_type,
            column_map=raw_map,
        )
    except excel_import.SheetCountError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}") from exc

    return ParseUploadOut(**parsed)


@router.post("/validate-rows", response_model=ValidateRowsOut)
def validate_rows(
    body: ValidateRowsIn,
    db: DbSession,
    _user: User = Depends(require_permission("invoicing")),
) -> ValidateRowsOut:
    rows = [r.model_dump() for r in body.rows]
    result = invoice_validation.validate_rows(
        db,
        rows,
        invoice_type=body.invoice_type,
        exclude_invoice_id=body.exclude_invoice_id,
    )
    return ValidateRowsOut(**result)


@router.post("/draft", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def save_draft(
    body: DraftInvoiceIn,
    db: DbSession,
    user: CurrentUser,
) -> InvoiceOut:
    if not role_allowed(user.role, "invoicing"):
        raise HTTPException(status_code=403, detail="Missing permission: invoicing")

    try:
        invoice = invoice_service.create_draft(
            db,
            user=user,
            invoice_no=body.invoice_no,
            invoice_type=body.invoice_type,
            seller_id=body.seller_id,
            buyer_id=body.buyer_id,
            seller_gst_id=body.seller_gst_id,
            buyer_gst_id=body.buyer_gst_id,
            invoice_date=body.invoice_date,
            country_of_origin=body.country_of_origin,
            currency=body.currency,
            notes=body.notes,
            source_file_name=body.source_file_name,
            rows=[r.model_dump() for r in body.rows],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return InvoiceOut(**invoice_service.invoice_to_out(invoice))


@router.get("", response_model=InvoiceListOut)
def list_invoices(
    db: DbSession,
    user: CurrentUser,
    status_filter: str | None = Query(default=None, alias="status"),
    invoice_type: str | None = Query(default=None),
    mine: bool = Query(default=False),
    seller_id: int | None = Query(default=None),
    buyer_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    invoice_no: str | None = Query(default=None),
    imei: str | None = Query(default=None),
    include_deleted: bool = Query(default=False),
) -> InvoiceListOut:
    if not (
        role_allowed(user.role, "invoicing")
        or role_allowed(user.role, "history")
        or role_allowed(user.role, "all_invoices")
    ):
        raise HTTPException(status_code=403, detail="Missing permission")

    # History = mine; All Invoices requires all_invoices permission
    if not mine and not role_allowed(user.role, "all_invoices"):
        # Non-all-invoices roles are forced to their own history
        mine = True

    if include_deleted and user.role != "ADMIN":
        include_deleted = False

    rows = invoice_service.list_invoices(
        db,
        created_by=user.id if mine else None,
        invoice_type=invoice_type,
        status=status_filter,
        seller_id=seller_id,
        buyer_id=buyer_id,
        date_from=date_from,
        date_to=date_to,
        invoice_no=invoice_no,
        imei=imei,
        include_deleted=include_deleted,
    )
    return InvoiceListOut(
        invoices=[invoice_service.invoice_to_out(r) for r in rows],
        total=len(rows),
    )


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> InvoiceOut:
    if not (
        role_allowed(user.role, "invoicing")
        or role_allowed(user.role, "history")
        or role_allowed(user.role, "all_invoices")
    ):
        raise HTTPException(status_code=403, detail="Missing permission")
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    all_scope = role_allowed(user.role, "all_invoices")
    if not can_view_invoice(user, invoice, all_scope=all_scope):
        raise HTTPException(status_code=403, detail="Not allowed to view this invoice")
    return InvoiceOut(**invoice_service.invoice_to_out(invoice))


@router.put("/{invoice_id}", response_model=InvoiceOut)
def update_invoice(
    invoice_id: int,
    body: UpdateInvoiceIn,
    db: DbSession,
    user: CurrentUser,
) -> InvoiceOut:
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None or invoice.is_deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not can_edit_invoice(user, invoice):
        raise HTTPException(status_code=403, detail="Not allowed to edit this invoice")
    try:
        updated = invoice_service.update_invoice(
            db,
            invoice=invoice,
            user=user,
            invoice_no=body.invoice_no,
            buyer_id=body.buyer_id,
            seller_gst_id=body.seller_gst_id,
            buyer_gst_id=body.buyer_gst_id,
            invoice_date=body.invoice_date,
            country_of_origin=body.country_of_origin,
            currency=body.currency,
            notes=body.notes,
            source_file_name=body.source_file_name,
            rows=[r.model_dump() for r in body.rows],
            regenerate_pdf=body.regenerate_pdf,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Update failed: {exc}") from exc
    return InvoiceOut(**invoice_service.invoice_to_out(updated))


@router.delete("/{invoice_id}", response_model=InvoiceOut)
def delete_invoice(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> InvoiceOut:
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not can_delete_invoice(user, invoice):
        raise HTTPException(status_code=403, detail="Only ADMIN can delete invoices")
    try:
        deleted = invoice_service.soft_delete_invoice(db, invoice=invoice, user=user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return InvoiceOut(**invoice_service.invoice_to_out(deleted))


@router.post("/{invoice_id}/finalize", response_model=InvoiceOut)
def finalize_invoice(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> InvoiceOut:
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None or invoice.is_deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not can_edit_invoice(user, invoice):
        raise HTTPException(status_code=403, detail="Not allowed to finalize this invoice")
    try:
        finalized = invoice_service.render_and_finalize(db, invoice=invoice, user=user, mark_final=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc
    return InvoiceOut(**invoice_service.invoice_to_out(finalized))


@router.post("/{invoice_id}/regenerate-pdf", response_model=InvoiceOut)
def regenerate_pdf(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> InvoiceOut:
    """Re-render PDF and ensure status is FINAL."""
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None or invoice.is_deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not can_edit_invoice(user, invoice):
        raise HTTPException(status_code=403, detail="Not allowed to regenerate this invoice")
    try:
        updated = invoice_service.render_and_finalize(
            db, invoice=invoice, user=user, mark_final=True
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc
    return InvoiceOut(**invoice_service.invoice_to_out(updated))


@router.get("/{invoice_id}/pdf")
def download_pdf(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> FileResponse:
    if not (
        role_allowed(user.role, "invoicing")
        or role_allowed(user.role, "history")
        or role_allowed(user.role, "all_invoices")
    ):
        raise HTTPException(status_code=403, detail="Missing permission")
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    all_scope = role_allowed(user.role, "all_invoices")
    if not can_view_invoice(user, invoice, all_scope=all_scope):
        raise HTTPException(status_code=403, detail="Not allowed to view this invoice")
    if not invoice.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    path = Path(invoice.pdf_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="PDF file missing on disk")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.name,
        headers={"Content-Disposition": f'inline; filename="{path.name}"'},
    )


@router.get("/{invoice_id}/excel")
def download_excel(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> Response:
    """Excel copy of the IMEI sheet, built from the saved line items."""
    if not (
        role_allowed(user.role, "invoicing")
        or role_allowed(user.role, "history")
        or role_allowed(user.role, "all_invoices")
    ):
        raise HTTPException(status_code=403, detail="Missing permission")
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    all_scope = role_allowed(user.role, "all_invoices")
    if not can_view_invoice(user, invoice, all_scope=all_scope):
        raise HTTPException(status_code=403, detail="Not allowed to view this invoice")
    if not invoice.items:
        raise HTTPException(status_code=400, detail="Invoice has no line items")
    filename = f"{invoice_service._safe_filename(invoice.invoice_no)}.xlsx"
    return Response(
        content=build_invoice_excel(invoice, list(invoice.items)),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )




@router.get("/{invoice_id}/history")
def invoice_history(
    invoice_id: int,
    db: DbSession,
    user: CurrentUser,
) -> dict:
    """Who created, edited and regenerated this invoice, newest first."""
    if not (
        role_allowed(user.role, "invoicing")
        or role_allowed(user.role, "history")
        or role_allowed(user.role, "all_invoices")
    ):
        raise HTTPException(status_code=403, detail="Missing permission")
    invoice = invoice_service.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    all_scope = role_allowed(user.role, "all_invoices")
    if not can_view_invoice(user, invoice, all_scope=all_scope):
        raise HTTPException(status_code=403, detail="Not allowed to view this invoice")
    return {"entries": invoice_service.invoice_history(db, invoice_id)}
