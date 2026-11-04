"""Signature/stamp image processing: white-bg removal, trim, save as PNG."""

from __future__ import annotations

import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.paths import ensure_app_subdirs

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
}


def _near_white(r: int, g: int, b: int, threshold: int = 245) -> bool:
    return r >= threshold and g >= threshold and b >= threshold


def process_to_transparent_png(data: bytes) -> bytes:
    """Remove near-white background, trim empty borders, return PNG bytes."""
    img = Image.open(BytesIO(data))
    img = img.convert("RGBA")
    pixels = img.load()
    assert pixels is not None
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if _near_white(r, g, b):
                pixels[x, y] = (r, g, b, 0)

    # Trim transparent borders
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    out = BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def save_company_logo(data: bytes, company_key: str) -> str:
    """Store a company logo as PNG without knocking out the background."""
    img = Image.open(BytesIO(data))
    img = img.convert("RGBA")
    dirs = ensure_app_subdirs()
    filename = f"{company_key}_logo_{uuid.uuid4().hex[:10]}.png"
    path = dirs["logos"] / filename
    img.save(path, format="PNG")
    return str(path)


def save_company_asset(kind: str, data: bytes, company_key: str) -> str:
    """
    Process and store under signatures/ or stamps/.
    Returns absolute path string stored in DB.
    """
    if kind not in {"signature", "stamp"}:
        raise ValueError("kind must be signature or stamp")

    dirs = ensure_app_subdirs()
    folder = dirs["signatures"] if kind == "signature" else dirs["stamps"]
    processed = process_to_transparent_png(data)
    filename = f"{company_key}_{kind}_{uuid.uuid4().hex[:10]}.png"
    path = folder / filename
    path.write_bytes(processed)
    return str(path)


def delete_asset_if_exists(path_str: str | None) -> None:
    if not path_str:
        return
    path = Path(path_str)
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass
