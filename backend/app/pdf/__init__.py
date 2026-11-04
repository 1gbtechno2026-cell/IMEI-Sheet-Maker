"""PDF generation package — layout lives in templates.py, rendering in generator.py."""

from app.pdf.generator import generate_invoice_pdf

__all__ = ["generate_invoice_pdf"]
