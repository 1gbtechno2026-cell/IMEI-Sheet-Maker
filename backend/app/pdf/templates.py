"""PDF layout constants — tweak margins, fonts, and table styles here."""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm

PAGE_SIZE = A4
PAGE_WIDTH, PAGE_HEIGHT = PAGE_SIZE

# Margins
MARGIN_LEFT = 14 * mm
MARGIN_RIGHT = 14 * mm
MARGIN_TOP = 14 * mm
MARGIN_BOTTOM = 16 * mm

# Annexure packing
ANNEXURE_ROWS_PER_PAGE = 36

# Colors
LINE = colors.HexColor("#333333")
HEADER_BG = colors.HexColor("#F0F0F0")
MUTED = colors.HexColor("#555555")


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "InvTitle",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=8,
            textColor=LINE,
        ),
        "section": ParagraphStyle(
            "InvSection",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=LINE,
            spaceBefore=4,
            spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "InvBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            alignment=TA_LEFT,
            textColor=LINE,
        ),
        "meta": ParagraphStyle(
            "InvMeta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=LINE,
        ),
        "meta_right": ParagraphStyle(
            "InvMetaRight",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            alignment=TA_RIGHT,
            textColor=LINE,
        ),
        "small": ParagraphStyle(
            "InvSmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=MUTED,
        ),
        "sign": ParagraphStyle(
            "InvSign",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            alignment=TA_RIGHT,
            textColor=LINE,
        ),
        "sign_bold": ParagraphStyle(
            "InvSignBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            alignment=TA_RIGHT,
            textColor=LINE,
        ),
        "footer": ParagraphStyle(
            "InvFooter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            alignment=TA_CENTER,
            textColor=MUTED,
        ),
    }


TABLE_HEADER_STYLE = [
    ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("ALIGN", (0, 0), (0, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("GRID", (0, 0), (-1, -1), 0.4, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]
