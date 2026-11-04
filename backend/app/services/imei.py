"""IMEI validation helpers (15 digits + Luhn)."""

from __future__ import annotations


def normalize_imei(raw: str | None) -> str:
    if raw is None:
        return ""
    # Keep digits only — spreadsheets often store IMEI as float/sci notation handled upstream
    return "".join(ch for ch in str(raw).strip() if ch.isdigit())


def luhn_ok(imei: str) -> bool:
    if len(imei) != 15 or not imei.isdigit():
        return False
    total = 0
    for i, ch in enumerate(reversed(imei)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def validate_imei(raw: str | None) -> tuple[str, list[str]]:
    """Return (normalized_imei, errors)."""
    errors: list[str] = []
    imei = normalize_imei(raw)
    if not imei:
        errors.append("IMEI is blank")
        return imei, errors
    if len(imei) != 15:
        errors.append(f"IMEI must be 15 digits (got {len(imei)})")
        return imei, errors
    if not luhn_ok(imei):
        errors.append("IMEI failed Luhn check")
    return imei, errors
