"""Company onboarding API (ADMIN / MANAGER)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.deps import DbSession, require_permission
from app.models import User
from app.schemas.companies import CompanyListOut, CompanyOut
from app.services import companies as company_service
from app.services.image_processing import ALLOWED_CONTENT_TYPES

router = APIRouter(prefix="/companies", tags=["companies"])

ManageUser = Depends(require_permission("onboarding"))


async def _read_image(upload: UploadFile | None) -> bytes | None:
    if upload is None:
        return None
    content_type = (upload.content_type or "").lower()
    filename = (upload.filename or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES and not filename.endswith(
        (".png", ".jpg", ".jpeg")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be PNG or JPG",
        )
    data = await upload.read()
    if not data:
        return None
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image too large (max 8MB)",
        )
    return data


def _parse_bool(value: str | bool) -> bool:
    if isinstance(value, bool):
        return value
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_gst_rows(raw: str | None) -> list[dict[str, str]]:
    if not raw or not raw.strip():
        raise ValueError("Add at least one GST")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("GST rows must be JSON") from exc
    if not isinstance(data, list) or not data:
        raise ValueError("Add at least one GST")
    rows: list[dict[str, str]] = []
    for item in data:
        if not isinstance(item, dict):
            raise ValueError("Each GST row needs a label, state, and GSTIN")
        label = str(item.get("label") or "").strip()
        state = str(item.get("state") or "").strip()
        gstin = str(item.get("gstin") or "").strip()
        if not label or not state or not gstin:
            raise ValueError("Each GST row needs a label, state, and GSTIN")
        rows.append({"label": label, "state": state, "gstin": gstin})
    return rows


@router.get("", response_model=CompanyListOut)
def list_companies(
    db: DbSession,
    _user: User = ManageUser,
    q: str | None = Query(default=None),
    include_inactive: bool = Query(default=True),
) -> CompanyListOut:
    rows = company_service.list_companies(db, q=q, include_inactive=include_inactive)
    return CompanyListOut(
        companies=[company_service.to_out(c) for c in rows],
        total=len(rows),
    )


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: int,
    db: DbSession,
    _user: User = ManageUser,
) -> CompanyOut:
    company = company_service.get_company(db, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company_service.to_out(company)


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    db: DbSession,
    _user: User = ManageUser,
    name: str = Form(...),
    address: str | None = Form(default=None),
    gstin: str | None = Form(default=None),
    pan: str | None = Form(default=None),
    state: str | None = Form(default=None),
    country: str | None = Form(default=None),
    phone: str | None = Form(default=None),
    email: str | None = Form(default=None),
    can_be_seller: str = Form(default="true"),
    can_be_buyer: str = Form(default="true"),
    invoice_prefix: str | None = Form(default=None),
    gst_rows: str | None = Form(default=None),
    signature: UploadFile | None = File(default=None),
    stamp: UploadFile | None = File(default=None),
    logo: UploadFile | None = File(default=None),
) -> CompanyOut:
    if not name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    try:
        sig = await _read_image(signature)
        stp = await _read_image(stamp)
        logo_bytes = await _read_image(logo)
        company = company_service.create_company(
            db,
            name=name,
            address=address,
            gstin=gstin,
            pan=pan,
            state=state,
            country=country,
            phone=phone,
            email=email,
            can_be_seller=_parse_bool(can_be_seller),
            can_be_buyer=_parse_bool(can_be_buyer),
            invoice_prefix=invoice_prefix,
            gst_rows=_parse_gst_rows(gst_rows),
            signature_bytes=sig,
            stamp_bytes=stp,
            logo_bytes=logo_bytes,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # Pillow / IO
        raise HTTPException(status_code=400, detail=f"Image processing failed: {exc}") from exc
    return company_service.to_out(company)


@router.put("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: int,
    db: DbSession,
    _user: User = ManageUser,
    name: str = Form(...),
    address: str | None = Form(default=None),
    gstin: str | None = Form(default=None),
    pan: str | None = Form(default=None),
    state: str | None = Form(default=None),
    country: str | None = Form(default=None),
    phone: str | None = Form(default=None),
    email: str | None = Form(default=None),
    can_be_seller: str = Form(default="true"),
    can_be_buyer: str = Form(default="true"),
    invoice_prefix: str | None = Form(default=None),
    gst_rows: str | None = Form(default=None),
    clear_signature: str = Form(default="false"),
    clear_stamp: str = Form(default="false"),
    clear_logo: str = Form(default="false"),
    signature: UploadFile | None = File(default=None),
    stamp: UploadFile | None = File(default=None),
    logo: UploadFile | None = File(default=None),
) -> CompanyOut:
    company = company_service.get_company(db, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    try:
        sig = await _read_image(signature)
        stp = await _read_image(stamp)
        logo_bytes = await _read_image(logo)
        updated = company_service.update_company(
            db,
            company,
            name=name,
            address=address,
            gstin=gstin,
            pan=pan,
            state=state,
            country=country,
            phone=phone,
            email=email,
            can_be_seller=_parse_bool(can_be_seller),
            can_be_buyer=_parse_bool(can_be_buyer),
            invoice_prefix=invoice_prefix,
            gst_rows=_parse_gst_rows(gst_rows),
            signature_bytes=sig,
            stamp_bytes=stp,
            logo_bytes=logo_bytes,
            clear_signature=_parse_bool(clear_signature),
            clear_stamp=_parse_bool(clear_stamp),
            clear_logo=_parse_bool(clear_logo),
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {exc}") from exc
    return company_service.to_out(updated)


@router.post("/{company_id}/deactivate", response_model=CompanyOut)
def deactivate_company(
    company_id: int,
    db: DbSession,
    _user: User = ManageUser,
) -> CompanyOut:
    company = company_service.get_company(db, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company_service.to_out(company_service.deactivate_company(db, company))


@router.post("/{company_id}/activate", response_model=CompanyOut)
def activate_company(
    company_id: int,
    db: DbSession,
    _user: User = ManageUser,
) -> CompanyOut:
    company = company_service.get_company(db, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company_service.to_out(company_service.activate_company(db, company))


@router.get("/{company_id}/assets/{kind}")
def get_company_asset(
    company_id: int,
    kind: str,
    db: DbSession,
    _user: User = ManageUser,
) -> FileResponse:
    if kind not in {"signature", "stamp", "logo"}:
        raise HTTPException(status_code=400, detail="kind must be signature, stamp, or logo")
    company = company_service.get_company(db, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    path_str = {
        "signature": company.signature_path,
        "stamp": company.stamp_path,
        "logo": company.logo_path,
    }[kind]
    if not path_str:
        raise HTTPException(status_code=404, detail=f"No {kind} on file")
    path = Path(path_str)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"{kind} file missing on disk")
    return FileResponse(path, media_type="image/png", filename=path.name)
