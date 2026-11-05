"""IMEI sheet PDF that is sent with the invoice.

Each page opens with a boxed header: seller and buyer on the top row,
invoice date and invoice number underneath, and country of origin when set.
The body is Serial No | Box No | Modal | IMEI NO, two models side by side.
One combined sign-and-stamp image sits at the bottom right.
"""

from __future__ import annotations

from collections import OrderedDict
from html import escape
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image as FlowImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.pdf.templates import (
    MARGIN_LEFT,
    MARGIN_RIGHT,
    PAGE_HEIGHT,
    PAGE_SIZE,
    PAGE_WIDTH,
    build_styles,
)

BOTTOM_MARGIN = 40 * mm
HEADER_TOP = 8 * mm
HEADER_GAP = 4 * mm
MODELS_PER_ROW = 2
HEADER_LINE = colors.HexColor("#222222")
HEADER_FILL = colors.HexColor("#F7F7F7")


class NumberedCanvas(canvas.Canvas):
    """Adds Page X of Y after the document is built."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []

    def showPage(self) -> None:  # noqa: N802 — ReportLab API
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(page_count)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _draw_page_number(self, page_count: int) -> None:
        page_num = self._pageNumber
        text = f"Page {page_num} of {page_count}"
        self.setFont("Helvetica", 7)
        self.setFillGray(0.35)
        self.drawString(MARGIN_LEFT, 5 * mm, text)


def _esc(value: object) -> str:
    return escape(str(value or ""))


def _fmt_date(value: Any) -> str:
    if hasattr(value, "strftime"):
        return value.strftime("%d-%m-%Y")
    return str(value or "")


def _header_styles() -> dict[str, ParagraphStyle]:
    return {
        "party": ParagraphStyle(
            "SheetParty",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
            textColor=colors.black,
        ),
        "meta": ParagraphStyle(
            "SheetMeta",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            alignment=TA_LEFT,
            textColor=colors.black,
        ),
    }


def _party_cell(title: str, company: Any, style: ParagraphStyle, gstin: str | None = None) -> Paragraph:
    name = _esc(getattr(company, "name", "") or "")
    gst_text = _esc(gstin if gstin is not None else getattr(company, "gstin", "") or "")
    gst = f"<br/>GSTIN: {gst_text}" if gst_text else ""
    return Paragraph(
        f"<font size='7' color='#5C5C5C'>{_esc(title)}</font><br/><b>{name}</b>{gst}",
        style,
    )


def _meta_cell(label: str, value: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(
        f"<font size='7' color='#5C5C5C'>{_esc(label)}</font><br/><b>{_esc(value)}</b>",
        style,
    )


def _logo_flowable(path_str: str | None) -> FlowImage | None:
    if not path_str or not Path(path_str).is_file():
        return None
    try:
        return FlowImage(path_str, width=16 * mm, height=16 * mm, kind="proportional")
    except Exception:
        return None


def _header_table(
    *,
    seller: Any,
    buyer: Any,
    seller_gstin: str,
    buyer_gstin: str,
    invoice_date: str,
    invoice_no: str,
    logo_path: str | None,
    usable: float,
) -> Table:
    """Bordered page header: logo and seller | buyer, then date | invoice no."""
    styles = _header_styles()
    half = usable / 2
    seller_cell: Any = _party_cell("SELLER", seller, styles["party"], seller_gstin)
    logo = _logo_flowable(logo_path)
    if logo is not None:
        logo_width = 18 * mm
        nested = Table([[logo, seller_cell]], colWidths=[logo_width, half - logo_width - 8])
        nested.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        seller_cell = nested
    data: list[list[Any]] = [
        [
            seller_cell,
            _party_cell("BUYER", buyer, styles["party"], buyer_gstin),
        ],
        [
            _meta_cell("INVOICE DATE", invoice_date, styles["meta"]),
            _meta_cell("INVOICE NO", invoice_no, styles["meta"]),
        ],
    ]
    table = Table(data, colWidths=[half, half])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL),
                ("BOX", (0, 0), (-1, -1), 1, HEADER_LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, HEADER_LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _sign_stamp_path(seller: Any) -> str | None:
    """One combined sign-and-stamp image. Stamp is the upload; signature is legacy."""
    for attr in ("stamp_path", "signature_path"):
        path_str = getattr(seller, attr, None)
        if path_str and Path(path_str).is_file():
            return str(path_str)
    return None


def _draw_fitted_image(
    pdf: canvas.Canvas,
    path_str: str | None,
    right: float,
    bottom: float,
    max_w: float,
    max_h: float,
) -> float:
    """Draw an image flush to `right`. Return the width used, or 0."""
    if not path_str:
        return 0
    path = Path(path_str)
    if not path.is_file():
        return 0
    try:
        reader = ImageReader(str(path))
        iw, ih = reader.getSize()
        if iw <= 0 or ih <= 0:
            return 0
        scale = min(max_w / float(iw), max_h / float(ih))
        draw_w = float(iw) * scale
        draw_h = float(ih) * scale
        pdf.drawImage(
            str(path),
            right - draw_w,
            bottom,
            width=draw_w,
            height=draw_h,
            mask="auto",
            preserveAspectRatio=True,
            anchor="sw",
        )
        return draw_w
    except Exception:
        return 0


def _paint_sign(pdf: canvas.Canvas, seller: Any) -> None:
    """Single sign-and-stamp image, bottom right of every page."""
    path = _sign_stamp_path(seller)
    if not path:
        return
    _draw_fitted_image(
        pdf,
        path,
        PAGE_WIDTH - MARGIN_RIGHT,
        8 * mm,
        72 * mm,
        26 * mm,
    )


def _group_by_model(items: list[Any]) -> OrderedDict[tuple[str, str], list[Any]]:
    """Items per (model, colour), in sheet order."""
    grouped: OrderedDict[tuple[str, str], list[Any]] = OrderedDict()
    for item in items:
        key = (str(item.model_no or ""), str(getattr(item, "color", None) or ""))
        grouped.setdefault(key, []).append(item)
    return grouped


def _pair_table(
    models: list[tuple[str, str]],
    grouped: OrderedDict[tuple[str, str], list[Any]],
    usable: float,
    *,
    include_box: bool,
    include_color: bool = False,
) -> Table:
    lists = [grouped[key] for key in models]
    height = max(len(rows) for rows in lists)
    kinds = ["serial"] + (["box"] if include_box else []) + ["model"] + (["color"] if include_color else []) + ["imei"]
    titles = {"serial": "Serial No", "box": "Box No", "model": "Modal", "color": "Colour", "imei": "IMEI NO"}
    weights = {"serial": 1.4, "box": 1.2, "model": 3.0 if include_color else 4.3, "color": 1.3, "imei": 2.5}
    per_model = len(kinds)
    header: list[str] = []
    for _key in models:
        header.extend(titles[kind] for kind in kinds)

    data: list[list[str]] = [header]
    for index in range(height):
        row: list[str] = []
        for (name, color), rows in zip(models, lists):
            if index >= len(rows):
                row.extend([""] * per_model)
                continue
            item = rows[index]
            box = str(item.box_no or "")
            previous = str(rows[index - 1].box_no or "") if index else ""
            values = {
                "serial": str(index + 1),
                "box": "" if box and box == previous else box,
                "model": name,
                "color": color,
                "imei": item.imei,
            }
            row.extend(values[kind] for kind in kinds)
        data.append(row)

    # Two models share the width; a lone model on the last row keeps the same column widths.
    block = usable / MODELS_PER_ROW
    total_weight = sum(weights[kind] for kind in kinds)
    widths = [block * weights[kind] / total_weight for kind in kinds] * len(models)

    table = Table(data, colWidths=widths, repeatRows=1)
    style: list[tuple] = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    for start in range(0, len(header), per_model):
        for offset, kind in enumerate(kinds):
            if kind != "model":
                style.append(("ALIGN", (start + offset, 1), (start + offset, -1), "CENTER"))
    if len(models) == 2:
        style.append(("LINEAFTER", (per_model - 1, 0), (per_model - 1, -1), 1.25, colors.black))
    table.setStyle(TableStyle(style))
    return table


def _box_span(values: list[str]) -> tuple[str, int]:
    numbers: list[int] = []
    others: list[str] = []
    seen_numbers: set[int] = set()
    seen_others: set[str] = set()
    for raw in values:
        text = str(raw or "").strip()
        if not text:
            continue
        if text.isdigit():
            number = int(text)
            if number not in seen_numbers:
                seen_numbers.add(number)
                numbers.append(number)
        elif text not in seen_others:
            seen_others.add(text)
            others.append(text)
    numbers.sort()
    parts: list[str] = []
    if numbers:
        ranges: list[str] = []
        start = previous = numbers[0]
        for number in numbers[1:]:
            if number == previous + 1:
                previous = number
                continue
            ranges.append(f"{start}-{previous}" if start != previous else str(start))
            start = previous = number
        ranges.append(f"{start}-{previous}" if start != previous else str(start))
        parts.append(", ".join(ranges))
    if others:
        parts.append(", ".join(others))
    return ", ".join(parts), len(numbers) + len(others)


def _summary_table(seller: Any, invoice_no: str, invoice_date: str, items: list[Any], usable: float) -> Table:
    """First page of an international sheet: units, boxes, and one row per model."""
    grouped: OrderedDict[tuple[str, str, str], list[str]] = OrderedDict()
    for item in items:
        key = (
            str(item.model_no or ""),
            str(getattr(item, "color", None) or ""),
            str(getattr(item, "country_of_origin", "") or ""),
        )
        grouped.setdefault(key, []).append(str(item.box_no or ""))
    has_color = any(color for _model, color, _country in grouped)

    body_style = ParagraphStyle(
        "SummaryBody",
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        alignment=TA_LEFT,
    )
    head_style = ParagraphStyle(
        "SummaryHead",
        fontName="Helvetica-BoldOblique",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
    )
    title_style = ParagraphStyle(
        "SummaryTitle",
        fontName="Helvetica-BoldOblique",
        fontSize=13,
        leading=16,
        alignment=1,
    )
    yellow = colors.HexColor("#FFF2CC")
    peach = colors.HexColor("#FCE4D6")
    orange = colors.HexColor("#F4B183")

    def cell(text: str, style: ParagraphStyle = body_style) -> Paragraph:
        return Paragraph(_esc(text), style)

    data: list[list[Any]] = [
        [Paragraph(_esc(getattr(seller, "name", "") or ""), title_style), "", "", "", ""],
        [cell("Invoice No. :-"), "", "", cell(invoice_no), ""],
        [cell("Invoice Date"), "", "", cell(invoice_date.replace("-", ".")), ""],
        [cell("Net Units"), "", "", cell(str(len(items))), ""],
        [cell("Total Number Of Boxes"), "", "", "", ""],
        [
            Paragraph("Model Wise Boxes" + (" (Colour)" if has_color else ""), head_style),
            Paragraph("Box No.", head_style),
            Paragraph("Number Of Boxes", head_style),
            Paragraph("Gross Units", head_style),
            Paragraph("COUNTRY OF ORIGIN", head_style),
        ],
    ]
    total_boxes = 0
    for (model, color, country), boxes in grouped.items():
        label, count = _box_span(boxes)
        total_boxes += count
        data.append(
            [
                cell(f"{model} - {color}" if color else model),
                cell(label),
                cell(str(count)),
                cell(str(len(boxes))),
                cell(country),
            ]
        )
    data[4][3] = cell(str(total_boxes))

    widths = [usable * 0.34, usable * 0.13, usable * 0.18, usable * 0.15, usable * 0.20]
    table = Table(data, colWidths=widths)
    style: list[tuple] = [
        ("SPAN", (0, 0), (4, 0)),
        ("BACKGROUND", (0, 0), (-1, 3), yellow),
        ("BACKGROUND", (0, 4), (-1, 4), peach),
        ("BACKGROUND", (0, 5), (-1, 5), orange),
        ("SPAN", (0, 1), (2, 1)),
        ("SPAN", (3, 1), (4, 1)),
        ("SPAN", (0, 2), (2, 2)),
        ("SPAN", (3, 2), (4, 2)),
        ("SPAN", (0, 3), (2, 3)),
        ("SPAN", (3, 3), (4, 3)),
        ("SPAN", (0, 4), (2, 4)),
        ("SPAN", (3, 4), (4, 4)),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#7F7F7F")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#BFBFBF")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    table.setStyle(TableStyle(style))
    return table


def _model_summary_table(items: list[Any], usable: float, *, include_box: bool, include_color: bool = False) -> Table:
    """Local sheets: one row per model with its quantity (and boxes), plus a total."""
    grouped = _group_by_model(items)
    head = ["Model"] + (["Colour"] if include_color else []) + ["Quantity"]
    if include_box:
        head += ["Units Per Box", "Number Of Boxes", "Box No."]
    data: list[list[str]] = [head]
    total_boxes = 0
    for (model, color), rows in grouped.items():
        line = [model] + ([color] if include_color else []) + [str(len(rows))]
        if include_box:
            boxes = [str(r.box_no or "") for r in rows]
            label, count = _box_span(boxes)
            total_boxes += count
            per_box = boxes.count(boxes[0]) if boxes[0] else ""
            line += [str(per_box), str(count), label]
        data.append(line)
    total = ["Total"] + ([""] if include_color else []) + [str(len(items))]
    data.append(total + (["", str(total_boxes), ""] if include_box else []))

    weights = [4.0] + ([1.4] if include_color else []) + [1.2] + ([1.6, 1.6, 1.6] if include_box else [])
    widths = [usable * w / sum(weights) for w in weights]
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F2F2F2")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _gstin_for(invoice: Any, company: Any, attr: str) -> str:
    chosen = getattr(invoice, attr, None)
    gstin = str(getattr(chosen, "gstin", "") or "").strip()
    if gstin:
        return gstin
    return str(getattr(company, "gstin", "") or "").strip()


def generate_invoice_pdf(
    *,
    invoice: Any,
    seller: Any,
    buyer: Any,
    items: list[Any],
    output_path: Path,
    footer_text: str | None = None,
) -> Path:
    """Render the IMEI sheet PDF to output_path and return the path."""
    styles = build_styles()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    invoice_no = str(invoice.invoice_no or "")
    invoice_date = _fmt_date(invoice.invoice_date)
    international = str(getattr(invoice, "invoice_type", "") or "") == "INTERNATIONAL"
    usable = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
    seller_gstin = _gstin_for(invoice, seller, "seller_gst")
    buyer_gstin = _gstin_for(invoice, buyer, "buyer_gst")
    logo_path = getattr(seller, "logo_path", None)
    header = _header_table(
        seller=seller,
        buyer=buyer,
        seller_gstin=seller_gstin,
        buyer_gstin=buyer_gstin,
        invoice_date=invoice_date,
        invoice_no=invoice_no,
        logo_path=logo_path,
        usable=usable,
    )
    _header_width, header_height = header.wrap(usable, 80 * mm)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=HEADER_TOP + header_height + HEADER_GAP,
        bottomMargin=BOTTOM_MARGIN,
        title=f"IMEI Sheet {invoice_no}",
    )

    story: list[Any] = []
    if international:
        story.append(_summary_table(seller, invoice_no, invoice_date, items, usable))
        story.append(PageBreak())
    grouped = _group_by_model(items)
    if getattr(invoice, "notes", None):
        story.append(Paragraph(f"<b>Notes:</b> {_esc(invoice.notes)}", styles["small"]))
        story.append(Spacer(1, 4))
    if footer_text and footer_text.strip():
        story.append(Paragraph(_esc(footer_text.strip()).replace("\n", "<br/>"), styles["small"]))
        story.append(Spacer(1, 4))

    model_names = list(grouped.keys())
    # Local sheets made by scanning carry box numbers too.
    include_box = international or any(getattr(item, "box_no", None) for item in items)
    include_color = any(getattr(item, "color", None) for item in items)
    if model_names and not international:
        # International already opens with its own summary page.
        story.append(Paragraph("<b>Summary</b>", styles["section"]))
        story.append(_model_summary_table(items, usable, include_box=include_box, include_color=include_color))
        story.append(Spacer(1, 10))
    if not model_names:
        story.append(Paragraph("No line items.", styles["body"]))
    else:
        for start in range(0, len(model_names), MODELS_PER_ROW):
            pair = model_names[start : start + MODELS_PER_ROW]
            story.append(_pair_table(pair, grouped, usable, include_box=include_box, include_color=include_color))
            if start + MODELS_PER_ROW < len(model_names):
                story.append(Spacer(1, 8))

    def _paint(pdf: canvas.Canvas, _doc: Any) -> None:
        block = _header_table(
            seller=seller,
            buyer=buyer,
            seller_gstin=seller_gstin,
            buyer_gstin=buyer_gstin,
            invoice_date=invoice_date,
            invoice_no=invoice_no,
            logo_path=logo_path,
            usable=usable,
        )
        block.wrap(usable, 80 * mm)
        block.drawOn(pdf, MARGIN_LEFT, PAGE_HEIGHT - HEADER_TOP - header_height)
        _paint_sign(pdf, seller)

    doc.build(
        story,
        canvasmaker=NumberedCanvas,
        onFirstPage=_paint,
        onLaterPages=_paint,
    )
    return output_path
