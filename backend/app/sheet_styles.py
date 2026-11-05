"""Look of the IMEI sheet (Excel and PDF). The layout is the same in every style."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SheetStyle:
    key: str
    label: str
    # Excel
    excel_font: str
    excel_header_fill: str  # column headers
    excel_header_text: str
    excel_section_fill: str  # SUMMARY / IMEI DATA bars
    excel_band_fill: str | None  # every other data row
    excel_border: str
    # PDF (built-in ReportLab fonts only, so nothing extra ships with the app)
    pdf_font: str
    pdf_bold: str
    pdf_italic: str
    pdf_bold_italic: str
    pdf_header_fill: str
    pdf_header_text: str
    pdf_band_fill: str | None
    pdf_grid: str
    pdf_party_fill: str
    # International summary page: title row, detail rows, total row, column-head row
    pdf_summary_fills: tuple[str, str, str, str]
    pdf_summary_head_text: str


STYLES: dict[str, SheetStyle] = {
    "classic": SheetStyle(
        key="classic",
        label="Classic",
        excel_font="Calibri",
        excel_header_fill="F2F2F2",
        excel_header_text="000000",
        excel_section_fill="1F2937",
        excel_band_fill=None,
        excel_border="B0B0B0",
        pdf_font="Helvetica",
        pdf_bold="Helvetica-Bold",
        pdf_italic="Helvetica-Oblique",
        pdf_bold_italic="Helvetica-BoldOblique",
        pdf_header_fill="#F2F2F2",
        pdf_header_text="#000000",
        pdf_band_fill=None,
        pdf_grid="#000000",
        pdf_party_fill="#F7F7F7",
        pdf_summary_fills=("#FFF2CC", "#FFF2CC", "#FCE4D6", "#F4B183"),
        pdf_summary_head_text="#000000",
    ),
    "corporate": SheetStyle(
        key="corporate",
        label="Corporate",
        excel_font="Arial",
        excel_header_fill="1F4E79",
        excel_header_text="FFFFFF",
        excel_section_fill="17375E",
        excel_band_fill="EEF4FA",
        excel_border="B4C6DB",
        pdf_font="Helvetica",
        pdf_bold="Helvetica-Bold",
        pdf_italic="Helvetica-Oblique",
        pdf_bold_italic="Helvetica-BoldOblique",
        pdf_header_fill="#1F4E79",
        pdf_header_text="#FFFFFF",
        pdf_band_fill="#EEF4FA",
        pdf_grid="#8EA9C8",
        pdf_party_fill="#EAF1F8",
        pdf_summary_fills=("#DCE6F1", "#EEF4FA", "#DDEBF7", "#1F4E79"),
        pdf_summary_head_text="#FFFFFF",
    ),
    "executive": SheetStyle(
        key="executive",
        label="Executive",
        excel_font="Cambria",
        excel_header_fill="1E4D3A",
        excel_header_text="FFFFFF",
        excel_section_fill="16392B",
        excel_band_fill="EFF5F1",
        excel_border="B7CCBF",
        pdf_font="Times-Roman",
        pdf_bold="Times-Bold",
        pdf_italic="Times-Italic",
        pdf_bold_italic="Times-BoldItalic",
        pdf_header_fill="#1E4D3A",
        pdf_header_text="#FFFFFF",
        pdf_band_fill="#EFF5F1",
        pdf_grid="#8FAE9B",
        pdf_party_fill="#EAF2EC",
        pdf_summary_fills=("#E3EFE6", "#EFF5F1", "#D5E8DA", "#1E4D3A"),
        pdf_summary_head_text="#FFFFFF",
    ),
}

DEFAULT_STYLE = "classic"


def get_style(key: str | None) -> SheetStyle:
    return STYLES.get(str(key or "").lower(), STYLES[DEFAULT_STYLE])
