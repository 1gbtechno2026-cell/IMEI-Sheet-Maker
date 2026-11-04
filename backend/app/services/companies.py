"""Company onboarding domain logic."""

from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Company, CompanyGst
from app.schemas.companies import CompanyGstOut, CompanyOut
from app.services import image_processing


def to_out(company: Company) -> CompanyOut:
    gsts = [
        CompanyGstOut(
            id=row.id,
            label=row.label,
            state=row.state,
            gstin=row.gstin,
            sort_order=row.sort_order,
        )
        for row in (company.gsts or [])
    ]
    return CompanyOut(
        id=company.id,
        name=company.name,
        address=company.address,
        gstin=company.gstin,
        pan=company.pan,
        state=company.state,
        country=company.country,
        phone=company.phone,
        email=company.email,
        can_be_seller=company.can_be_seller,
        can_be_buyer=company.can_be_buyer,
        signature_path=company.signature_path,
        stamp_path=company.stamp_path,
        logo_path=company.logo_path,
        has_signature=bool(company.signature_path),
        has_stamp=bool(company.stamp_path),
        has_logo=bool(company.logo_path),
        invoice_prefix=company.invoice_prefix,
        is_active=company.is_active,
        gsts=gsts,
        created_at=company.created_at,
        updated_at=company.updated_at,
    )


def list_companies(
    db: Session,
    *,
    q: str | None = None,
    include_inactive: bool = True,
    can_be_seller: bool | None = None,
    can_be_buyer: bool | None = None,
) -> list[Company]:
    stmt = select(Company).options(selectinload(Company.gsts))
    if not include_inactive:
        stmt = stmt.where(Company.is_active.is_(True))
    if can_be_seller is True:
        stmt = stmt.where(Company.can_be_seller.is_(True))
    if can_be_buyer is True:
        stmt = stmt.where(Company.can_be_buyer.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Company.name.ilike(like),
                Company.gsts.any(
                    or_(
                        CompanyGst.label.ilike(like),
                        CompanyGst.state.ilike(like),
                        CompanyGst.gstin.ilike(like),
                    )
                ),
            )
        )
    stmt = stmt.order_by(Company.name.asc(), Company.id.asc())
    return list(db.scalars(stmt).all())


def get_company(db: Session, company_id: int) -> Company | None:
    return db.scalar(
        select(Company).where(Company.id == company_id).options(selectinload(Company.gsts))
    )


def _replace_gsts(company: Company, gst_rows: list[dict[str, str]]) -> None:
    company.gsts.clear()
    for index, row in enumerate(gst_rows):
        company.gsts.append(
            CompanyGst(
                label=row["label"],
                state=row["state"],
                gstin=row["gstin"],
                sort_order=index,
            )
        )
    first = gst_rows[0]
    company.gstin = first["gstin"]
    company.state = first["state"]


def create_company(
    db: Session,
    *,
    name: str,
    address: str | None,
    gstin: str | None,
    pan: str | None,
    state: str | None,
    country: str | None,
    phone: str | None,
    email: str | None,
    can_be_seller: bool,
    can_be_buyer: bool,
    invoice_prefix: str | None,
    gst_rows: list[dict[str, str]],
    signature_bytes: bytes | None,
    stamp_bytes: bytes | None,
    logo_bytes: bytes | None,
) -> Company:
    company = Company(
        name=name.strip(),
        address=(address or None),
        gstin=(gstin or None),
        pan=(pan or None),
        state=(state or None),
        country=(country or None),
        phone=(phone or None),
        email=(email or None),
        can_be_seller=can_be_seller,
        can_be_buyer=can_be_buyer,
        invoice_prefix=(invoice_prefix or None),
        is_active=True,
    )
    db.add(company)
    db.flush()  # get id
    _replace_gsts(company, gst_rows)

    key = f"c{company.id}"
    if logo_bytes:
        company.logo_path = image_processing.save_company_logo(logo_bytes, key)
    if signature_bytes:
        company.signature_path = image_processing.save_company_asset(
            "signature", signature_bytes, key
        )
    if stamp_bytes:
        company.stamp_path = image_processing.save_company_asset("stamp", stamp_bytes, key)

    db.commit()
    db.refresh(company)
    return company


def update_company(
    db: Session,
    company: Company,
    *,
    name: str,
    address: str | None,
    gstin: str | None,
    pan: str | None,
    state: str | None,
    country: str | None,
    phone: str | None,
    email: str | None,
    can_be_seller: bool,
    can_be_buyer: bool,
    invoice_prefix: str | None,
    gst_rows: list[dict[str, str]],
    signature_bytes: bytes | None,
    stamp_bytes: bytes | None,
    logo_bytes: bytes | None,
    clear_signature: bool = False,
    clear_stamp: bool = False,
    clear_logo: bool = False,
) -> Company:
    company.name = name.strip()
    company.can_be_seller = can_be_seller
    company.can_be_buyer = can_be_buyer
    _replace_gsts(company, gst_rows)

    key = f"c{company.id}"

    if clear_logo:
        image_processing.delete_asset_if_exists(company.logo_path)
        company.logo_path = None
    if logo_bytes:
        image_processing.delete_asset_if_exists(company.logo_path)
        company.logo_path = image_processing.save_company_logo(logo_bytes, key)

    if clear_signature:
        image_processing.delete_asset_if_exists(company.signature_path)
        company.signature_path = None
    if signature_bytes:
        image_processing.delete_asset_if_exists(company.signature_path)
        company.signature_path = image_processing.save_company_asset(
            "signature", signature_bytes, key
        )

    if clear_stamp:
        image_processing.delete_asset_if_exists(company.stamp_path)
        company.stamp_path = None
    if stamp_bytes:
        image_processing.delete_asset_if_exists(company.stamp_path)
        company.stamp_path = image_processing.save_company_asset("stamp", stamp_bytes, key)

    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def deactivate_company(db: Session, company: Company) -> Company:
    company.is_active = False
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def activate_company(db: Session, company: Company) -> Company:
    company.is_active = True
    db.add(company)
    db.commit()
    db.refresh(company)
    return company
