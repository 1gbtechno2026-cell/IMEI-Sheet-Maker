"""IMEI data sheet: the blank template from Step 3 and the finished Excel copy.

Both use one layout on one sheet, so a finished file can be uploaded again:

    IMEI DATA SHEET
    Seller / Buyer / Invoice No / Invoice Date
    SUMMARY      Model | Colour | Quantity | Units per box | Number of boxes | Box No. | [Country]
    IMEI DATA    Serial No | Box No | Model | Colour | IMEI | [Country of Origin]   (one block per model)
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from app.pdf.generator import _box_span

SHEET_TITLE = "IMEI DATA SHEET"
SUMMARY_MARKER = "SUMMARY"
DATA_MARKER = "IMEI DATA"


def group_items(items: list[Any]) -> OrderedDict[tuple[str, str], list[Any]]:
    """Items per (model, colour), in sheet order."""
    grouped: OrderedDict[tuple[str, str], list[Any]] = OrderedDict()
    for item in items:
        key = (str(item.model_no or ""), str(getattr(item, "color", None) or ""))
        grouped.setdefault(key, []).append(item)
    return grouped


def _format_date(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.strftime("%d-%m-%Y")
    text = str(value or "").strip()
    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%d-%m-%Y")
    except ValueError:
        return text


def box_numbers(quantity: int, per_box: int) -> list[str]:
    """Box number for each unit. Numbers restart at 1 for every model."""
    if per_box <= 0:
        return [""] * quantity
    return [str(index // per_box + 1) for index in range(quantity)]


def _write_data_sheet(
    sheet: Any,
    *,
    international: bool,
    details: list[tuple[str, str]],
    models: list[dict[str, Any]],
) -> None:
    """models: name, color, quantity, per_box, country, boxes, imeis (None = blank template)."""
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    thin = Border(
        left=Side(style="thin", color="B0B0B0"),
        right=Side(style="thin", color="B0B0B0"),
        top=Side(style="thin", color="B0B0B0"),
        bottom=Side(style="thin", color="B0B0B0"),
    )
    bold = Font(bold=True, name="Calibri", size=11)
    header_fill = PatternFill("solid", fgColor="F2F2F2")
    section_fill = PatternFill("solid", fgColor="1F2937")
    section_font = Font(bold=True, name="Calibri", size=11, color="FFFFFF")
    blank_fill = PatternFill("solid", fgColor="FFF8E5")
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)

    has_box = international or any(m.get("per_box") for m in models)
    widths: dict[int, float] = {}

    def widen(col: int, width: float) -> None:
        widths[col] = max(widths.get(col, 0), width)

    def section(row: int, title: str, span: int) -> None:
        for col in range(1, span + 1):
            cell = sheet.cell(row, col, title if col == 1 else None)
            cell.fill = section_fill
            cell.font = section_font

    row = 1
    sheet.cell(row, 1, SHEET_TITLE).font = Font(bold=True, name="Calibri", size=14)
    row += 1
    for label, value in details:
        sheet.cell(row, 1, label).font = bold
        sheet.cell(row, 2, value)
        row += 1
    row += 1

    # Summary
    head = ["Model", "Colour", "Quantity"]
    if has_box:
        head += ["Units per box", "Number of boxes", "Box No."]
    if international:
        head += ["Country of Origin"]
    section(row, SUMMARY_MARKER, len(head))
    row += 1
    for col, text in enumerate(head, start=1):
        cell = sheet.cell(row, col, text)
        cell.font = bold
        cell.fill = header_fill
        cell.border = thin
        cell.alignment = center
    row += 1
    total_units = 0
    total_boxes = 0
    for model in models:
        line: list[Any] = [model["name"], model.get("color") or None, model["quantity"]]
        total_units += model["quantity"]
        if has_box:
            span, count = _box_span([b for b in model["boxes"] if b])
            total_boxes += count
            line += [model.get("per_box") or None, count, span]
        if international:
            line += [model.get("country") or None]
        for col, value in enumerate(line, start=1):
            cell = sheet.cell(row, col, value)
            cell.border = thin
            if col > 2:
                cell.alignment = center
        row += 1
    total = ["Total", None, total_units] + ([None, total_boxes, None] if has_box else [])
    for col, value in enumerate(total, start=1):
        cell = sheet.cell(row, col, value)
        cell.font = bold
        cell.border = thin
        if col > 2:
            cell.alignment = center
    row += 2

    # IMEI data: one block per model, a blank column between blocks
    kinds = ["serial"] + (["box"] if has_box else []) + ["model", "color", "imei"] + (["country"] if international else [])
    titles = {
        "serial": "Serial No",
        "box": "Box No",
        "model": "Model",
        "color": "Colour",
        "imei": "IMEI",
        "country": "Country of Origin",
    }
    col_widths = {"serial": 9, "box": 8, "model": 30, "color": 12, "imei": 19, "country": 18}
    blocks: list[tuple[dict[str, Any], int]] = []
    col = 1
    for model in models:
        blocks.append((model, col))
        col += len(kinds) + 1
    section(row, DATA_MARKER, max(col - 2, len(head)))
    row += 1
    header_row = row

    template = any(m.get("imeis") is None for m in models)
    for model, start in blocks:
        for offset, kind in enumerate(kinds):
            cell = sheet.cell(header_row, start + offset, titles[kind])
            cell.font = bold
            cell.fill = header_fill
            cell.border = thin
            cell.alignment = center
            widen(start + offset, col_widths[kind])
        widen(start + len(kinds), 3)

        imeis = model.get("imeis")
        countries = model.get("countries") or []
        previous_box = None
        for index in range(model["quantity"]):
            data_row = header_row + 1 + index
            box = model["boxes"][index] if index < len(model["boxes"]) else ""
            new_box = box != previous_box
            previous_box = box
            for offset, kind in enumerate(kinds):
                if kind == "serial":
                    value: Any = index + 1
                elif kind == "box":
                    value = (int(box) if box.isdigit() else box or None) if new_box else None
                elif kind == "model":
                    value = model["name"]
                elif kind == "color":
                    value = model.get("color") or None
                elif kind == "country":
                    country = countries[index] if index < len(countries) else model.get("country")
                    value = (country or None) if new_box else None
                else:
                    value = imeis[index] if imeis is not None else None
                cell = sheet.cell(data_row, start + offset, value)
                cell.border = thin
                if kind == "imei":
                    cell.number_format = "@"
                    if imeis is None:
                        cell.fill = blank_fill
                elif kind in ("serial", "box", "country"):
                    cell.alignment = center

        if template and model["quantity"]:
            letter = get_column_letter(start + kinds.index("imei"))
            check = DataValidation(
                type="textLength",
                operator="equal",
                formula1="15",
                allow_blank=True,
                showErrorMessage=True,
                errorTitle="IMEI",
                error="An IMEI has 15 digits.",
            )
            check.add(f"{letter}{header_row + 1}:{letter}{header_row + model['quantity']}")
            sheet.add_data_validation(check)

    widen(1, 30)
    for index in range(2, len(head) + 1):
        widen(index, 14)
    sheet.row_dimensions[header_row].height = 22
    for index, width in widths.items():
        sheet.column_dimensions[get_column_letter(index)].width = width


def _save(write: Any) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    sheet = wb.active
    sheet.title = "IMEI data"
    write(sheet)
    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()


def _details(seller: str, buyer: str, invoice_no: str, invoice_date: Any) -> list[tuple[str, str]]:
    return [
        ("Seller", seller or ""),
        ("Buyer", buyer or ""),
        ("Invoice No", invoice_no or ""),
        ("Invoice Date", _format_date(invoice_date)),
    ]


def build_data_template(
    *,
    invoice_type: str,
    seller_name: str,
    buyer_name: str,
    invoice_no: str,
    invoice_date: Any,
    models: list[dict[str, Any]],
) -> bytes:
    """Blank sheet from Step 3: summary, serial and box numbers, model and colour filled in; IMEIs empty."""
    international = invoice_type == "INTERNATIONAL"
    blocks = []
    for model in models:
        quantity = int(model["quantity"])
        per_box = int(model.get("units_per_box") or 0)
        blocks.append(
            {
                "name": str(model["model_no"]).strip(),
                "color": (model.get("color") or "").strip(),
                "quantity": quantity,
                "per_box": per_box or None,
                "country": (model.get("country_of_origin") or "").strip() if international else "",
                "boxes": box_numbers(quantity, per_box),
                "imeis": None,
            }
        )
    details = _details(seller_name, buyer_name, invoice_no, invoice_date)
    return _save(
        lambda sheet: _write_data_sheet(sheet, international=international, details=details, models=blocks)
    )


def build_invoice_excel(invoice: Any, items: list[Any]) -> bytes:
    """Finished sheet: same layout as the template, with the IMEIs filled in."""
    international = str(getattr(invoice, "invoice_type", "") or "") == "INTERNATIONAL"
    blocks = []
    for (model, color), rows in group_items(items).items():
        boxes = [str(r.box_no or "") for r in rows]
        per_box = boxes.count(boxes[0]) if boxes and boxes[0] else None
        countries = [r.country_of_origin or "" for r in rows]
        blocks.append(
            {
                "name": model,
                "color": color,
                "quantity": len(rows),
                "per_box": per_box,
                "country": next((c for c in countries if c), ""),
                "countries": countries,
                "boxes": boxes,
                "imeis": [str(r.imei) for r in rows],
            }
        )
    details = _details(
        getattr(getattr(invoice, "seller", None), "name", "") or "",
        getattr(getattr(invoice, "buyer", None), "name", "") or "",
        getattr(invoice, "invoice_no", "") or "",
        getattr(invoice, "invoice_date", None),
    )
    return _save(
        lambda sheet: _write_data_sheet(sheet, international=international, details=details, models=blocks)
    )


def write_invoice_excel(invoice: Any, items: list[Any], output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(build_invoice_excel(invoice, items))
    return output_path
