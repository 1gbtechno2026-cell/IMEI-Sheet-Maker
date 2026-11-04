"""Company onboarding schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CompanyGstOut(BaseModel):
    id: int
    label: str
    state: str
    gstin: str
    sort_order: int = 0

    model_config = {"from_attributes": True}


class CompanyOut(BaseModel):
    id: int
    name: str
    address: str | None = None
    gstin: str | None = None
    pan: str | None = None
    state: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    can_be_seller: bool
    can_be_buyer: bool
    signature_path: str | None = None
    stamp_path: str | None = None
    logo_path: str | None = None
    has_signature: bool = False
    has_stamp: bool = False
    has_logo: bool = False
    invoice_prefix: str | None = None
    is_active: bool
    gsts: list[CompanyGstOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyListOut(BaseModel):
    companies: list[CompanyOut]
    total: int


class CompanyWrite(BaseModel):
    """JSON body for create/update without files (optional alternate path)."""

    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    gstin: str | None = None
    pan: str | None = None
    state: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    can_be_seller: bool = True
    can_be_buyer: bool = True
    invoice_prefix: str | None = None
