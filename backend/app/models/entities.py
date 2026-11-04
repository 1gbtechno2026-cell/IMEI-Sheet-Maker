"""Core SQLAlchemy 2.x models matching the product spec tables."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # ADMIN|MANAGER|OPERATOR|VIEWER
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    can_be_seller: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_be_buyer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    signature_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    stamp_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    logo_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    invoice_prefix: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    gsts: Mapped[list["CompanyGst"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        order_by="CompanyGst.sort_order",
    )


class CompanyGst(Base):
    """One GST registration for a company, labelled per state."""

    __tablename__ = "company_gsts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    gstin: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    company: Mapped[Company] = relationship(back_populates="gsts")


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"
    __table_args__ = (
        UniqueConstraint(
            "seller_company_id",
            "invoice_type",
            "financial_year",
            name="uq_invoice_sequences_seller_type_fy",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    seller_company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id"), nullable=False
    )
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False)  # LOCAL|INTERNATIONAL
    financial_year: Mapped[str] = mapped_column(String(20), nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    seller = relationship("Company")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_no: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False)  # LOCAL|INTERNATIONAL
    seller_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    buyer_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    seller_gst_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("company_gsts.id"), nullable=True
    )
    buyer_gst_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("company_gsts.id"), nullable=True
    )
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    country_of_origin: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")  # DRAFT|FINAL
    pdf_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    source_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    seller = relationship("Company", foreign_keys=[seller_id])
    buyer = relationship("Company", foreign_keys=[buyer_id])
    seller_gst = relationship("CompanyGst", foreign_keys=[seller_gst_id])
    buyer_gst = relationship("CompanyGst", foreign_keys=[buyer_gst_id])


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(Integer, ForeignKey("invoices.id"), nullable=False)
    model_no: Mapped[str] = mapped_column(String(100), nullable=False)
    imei: Mapped[str] = mapped_column(String(20), nullable=False)
    box_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    country_of_origin: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rate: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # optional; store as text for Phase 1

    invoice = relationship("Invoice", back_populates="items")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    before_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    after_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
