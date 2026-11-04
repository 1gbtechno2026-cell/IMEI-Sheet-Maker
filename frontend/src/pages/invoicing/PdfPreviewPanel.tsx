import { useEffect, useState } from "react";

import {
  fetchInvoicePdfObjectUrl,
  regeneratePdf,
  type InvoiceRecord,
} from "../../api/invoices";
import { ApiError } from "../../api/client";

type Props = {
  invoice: InvoiceRecord;
  onUpdated?: (invoice: InvoiceRecord) => void;
};

export function PdfPreviewPanel({ invoice, onUpdated }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setError("");
    setUrl(null);

    if (!invoice.pdf_path) {
      return;
    }

    void (async () => {
      try {
        objectUrl = await fetchInvoicePdfObjectUrl(invoice.id);
        if (!cancelled) setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoice.id, invoice.pdf_path, invoice.status]);

  async function onDownload() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoice_no.replace(/[^\w.\-]+/g, "_")}.pdf`;
    a.click();
  }

  async function onOpenFolder() {
    if (!invoice.pdf_path) return;
    if (window.invoiceMaker?.showItemInFolder) {
      const res = await window.invoiceMaker.showItemInFolder(invoice.pdf_path);
      if (!res.ok) setError(res.error || "Could not open folder");
      return;
    }
    setError("Open folder requires the Electron app");
  }

  async function onPrint() {
    if (!url) return;
    if (window.invoiceMaker?.printPdfUrl) {
      const res = await window.invoiceMaker.printPdfUrl(url);
      if (!res.ok) setError(res.error || "Print failed");
      return;
    }
    // Browser fallback
    const w = window.open(url, "_blank");
    w?.print();
  }

  async function onRegenerate() {
    setBusy(true);
    setError("");
    try {
      const updated = await regeneratePdf(invoice.id);
      onUpdated?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-[var(--panel)]/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
            Step 5 — PDF preview
          </h2>
          <p className="mt-1 font-mono text-sm">
            {invoice.invoice_no} · {invoice.status}
            {invoice.pdf_path ? "" : " · PDF pending"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!url || busy}
            onClick={() => void onDownload()}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            Download
          </button>
          <button
            type="button"
            disabled={!invoice.pdf_path || busy}
            onClick={() => void onOpenFolder()}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            Open folder
          </button>
          <button
            type="button"
            disabled={!url || busy}
            onClick={() => void onPrint()}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            Print
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRegenerate()}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Regenerate PDF"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      {url ? (
        <iframe title="Invoice PDF" src={url} className="h-[70vh] w-full rounded-md border border-white/10 bg-white" />
      ) : (
        <p className="text-sm text-[var(--muted)]">
          {invoice.pdf_path ? "Loading PDF…" : "Generate / finalize to preview the PDF."}
        </p>
      )}
    </section>
  );
}
