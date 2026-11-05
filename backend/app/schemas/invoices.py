"""Invoice Phase 4 schemas (parse / validate / draft)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

InvoiceType = Literal["LOCAL", "INTERNATIONAL"]


class NumberPreviewOut(BaseModel):
    invoice_no: str
    financial_year: str
    next_number: int
    fy_start_month: int
    reserved: bool
    prefix: str
    type_code: str


class ColumnMapIn(BaseModel):
    model_no: str | None = None
    imei: str | None = None
    box_no: str | None = None
    country_of_origin: str | None = None


class InvoiceRowIn(BaseModel):
    row_index: int | None = None
    model_no: str = ""
    color: str | None = None
    imei: str = ""
    box_no: str | None = None
    country_of_origin: str | None = None


class ValidateRowsIn(BaseModel):
    invoice_type: InvoiceType
    rows: list[InvoiceRowIn]
    exclude_invoice_id: int | None = None


class DraftInvoiceIn(BaseModel):
    invoice_no: str = Field(min_length=1, max_length=100)
    invoice_type: InvoiceType
    seller_id: int
    buyer_id: int
    seller_gst_id: int | None = None
    buyer_gst_id: int | None = None
    invoice_date: date
    country_of_origin: str | None = None
    currency: str | None = None
    notes: str | None = None
    source_file_name: str | None = None
    rows: list[InvoiceRowIn] = Field(min_length=1)


class InvoiceItemOut(BaseModel):
    id: int
    model_no: str
    imei: str
    box_no: str | None = None
    rate: str | None = None


class InvoiceOut(BaseModel):
    id: int
    invoice_no: str
    invoice_type: str
    seller_id: int
    buyer_id: int
    seller_name: str | None = None
    buyer_name: str | None = None
    seller_gst_id: int | None = None
    buyer_gst_id: int | None = None
    seller_gsts: list[dict[str, Any]] = []
    buyer_gsts: list[dict[str, Any]] = []
    invoice_date: date
    country_of_origin: str | None = None
    currency: str | None = None
    status: str
    pdf_path: str | None = None
    source_file_name: str | None = None
    notes: str | None = None
    is_deleted: bool = False
    created_by: int | None = None
    item_count: int = 0
    summary: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime


class InvoiceListOut(BaseModel):
    invoices: list[InvoiceOut]
    total: int


class UpdateInvoiceIn(BaseModel):
    invoice_no: str | None = None
    buyer_id: int
    seller_gst_id: int | None = None
    buyer_gst_id: int | None = None
    invoice_date: date
    country_of_origin: str | None = None
    currency: str | None = None
    notes: str | None = None
    source_file_name: str | None = None
    rows: list[InvoiceRowIn] = Field(min_length=1)
    regenerate_pdf: bool = True


class TemplateModelIn(BaseModel):
    model_no: str = Field(min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=50)
    quantity: int = Field(ge=1, le=100000)
    units_per_box: int = Field(ge=1, le=10000)
    country_of_origin: str | None = None


class DataTemplateIn(BaseModel):
    invoice_type: str = Field(pattern="^(LOCAL|INTERNATIONAL)$")
    seller_name: str = ""
    buyer_name: str = ""
    invoice_no: str = ""
    invoice_date: str = ""
    models: list[TemplateModelIn] = Field(min_length=1)


class ParseUploadOut(BaseModel):
    headers: list[str]
    detected_map: dict[str, str | None]
    effective_map: dict[str, str | None] | None = None
    needs_manual_map: bool
    rows: list[dict[str, Any]]
    row_count: int
    source_file_name: str | None = None
    sheet_summary: list[dict[str, Any]] | None = None


class ValidateRowsOut(BaseModel):
    rows: list[dict[str, Any]]
    total: int
    valid_count: int
    error_count: int
    summary: list[dict[str, Any]]
    can_save: bool
