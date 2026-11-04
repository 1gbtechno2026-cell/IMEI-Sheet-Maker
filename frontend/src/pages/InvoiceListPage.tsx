import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../api/client";
import {
  deleteInvoice,
  fetchInvoicePdfObjectUrl,
  listInvoices,
  listParties,
  regeneratePdf,
  type InvoiceRecord,
} from "../api/invoices";
import type { Company } from "../api/companies";
import { useAuth } from "../auth/AuthContext";
import { useInvoiceMode } from "../auth/ModeContext";
import { ModeToggle } from "../layout/ModeToggle";

type Props = {
  scope: "history" | "all";
};

function canEdit(role: string, invoice: InvoiceRecord, userId: number | undefined) {
  if (invoice.is_deleted) return false;
  if (role === "VIEWER") return false;
  if (role === "ADMIN" || role === "MANAGER") return true;
  if (role === "OPERATOR") return invoice.created_by === userId;
  return false;
}

export function InvoiceListPage({ scope }: Props) {
  const { user } = useAuth();
  const { mode } = useInvoiceMode();
  const [rows, setRows] = useState<InvoiceRecord[]>([]);
  const [sellers, setSellers] = useState<Company[]>([]);
  const [buyers, setBuyers] = useState<Company[]>([]);
  const [sellerId, setSellerId] = useState<number | "">("");
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [imei, setImei] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ id: number; url: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await listInvoices({
      mine: scope === "history",
      invoice_type: mode,
      seller_id: sellerId === "" ? undefined : sellerId,
      buyer_id: buyerId === "" ? undefined : buyerId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      invoice_no: invoiceNo.trim() || undefined,
      imei: imei.trim() || undefined,
    });
    setRows(res.invoices);
  }, [scope, mode, sellerId, buyerId, dateFrom, dateTo, invoiceNo, imei]);

  useEffect(() => {
    void listParties("seller").then((r) => setSellers(r.companies)).catch(() => undefined);
    void listParties("buyer").then((r) => setBuyers(r.companies)).catch(() => undefined);
  }, []);

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof ApiError ? err.detail : String(err)));
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  async function onViewPdf(inv: InvoiceRecord) {
    setError("");
    try {
      const url = await fetchInvoicePdfObjectUrl(inv.id);
      if (preview?.url) URL.revokeObjectURL(preview.url);
      setPreview({ id: inv.id, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDownload(inv: InvoiceRecord) {
    try {
      const url = await fetchInvoicePdfObjectUrl(inv.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_no.replace(/[^\w.\-]+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onRegenerate(inv: InvoiceRecord) {
    setBusyId(inv.id);
    setError("");
    try {
      await regeneratePdf(inv.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(inv: InvoiceRecord) {
    if (!window.confirm(`Soft-delete invoice ${inv.invoice_no}?`)) return;
    setBusyId(inv.id);
    setError("");
    try {
      await deleteInvoice(inv.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusyId(null);
    }
  }

  const title = scope === "history" ? "History" : "All Invoices";
  const subtitle =
    scope === "history"
      ? "Invoices you created. Filtered by Local / International and search fields."
      : "Everyone's invoices (ADMIN / MANAGER).";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        <ModeToggle />
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-[var(--panel)]/70 p-4 md:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Seller</span>
          <select
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All</option>
            {sellers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Buyer</span>
          <select
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All</option>
            {buyers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">From</span>
          <input
            type="date"
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">To</span>
          <input
            type="date"
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Invoice no</span>
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="ACME/LOC/…"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">IMEI</span>
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 font-mono text-sm"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="15 digits"
          />
        </label>
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-black/30 text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">Buyer</th>
              <th className="px-3 py-2 font-medium">Units</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)]">
                  No invoices match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((inv) => {
                const editable = canEdit(user?.role || "", inv, user?.id);
                const isAdmin = user?.role === "ADMIN";
                return (
                  <tr key={inv.id} className="border-t border-white/10">
                    <td className="px-3 py-2 font-mono text-xs">{inv.invoice_no}</td>
                    <td className="px-3 py-2">{inv.invoice_date}</td>
                    <td className="px-3 py-2">{inv.seller_name || inv.seller_id}</td>
                    <td className="px-3 py-2">{inv.buyer_name || inv.buyer_id}</td>
                    <td className="px-3 py-2 font-mono">{inv.item_count}</td>
                    <td className="px-3 py-2">{inv.status}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          className="text-[var(--accent)] hover:underline"
                          disabled={!inv.pdf_path}
                          onClick={() => void onViewPdf(inv)}
                        >
                          View PDF
                        </button>
                        <button
                          type="button"
                          className="text-[var(--muted)] hover:underline"
                          disabled={!inv.pdf_path}
                          onClick={() => void onDownload(inv)}
                        >
                          Download
                        </button>
                        {editable && (
                          <Link className="text-[var(--accent)] hover:underline" to={`/invoices/${inv.id}/edit`}>
                            Edit
                          </Link>
                        )}
                        {editable && (
                          <button
                            type="button"
                            className="text-[var(--muted)] hover:underline"
                            disabled={busyId === inv.id}
                            onClick={() => void onRegenerate(inv)}
                          >
                            Regenerate
                          </button>
                        )}
                        {isAdmin && !inv.is_deleted && (
                          <button
                            type="button"
                            className="text-[var(--bad)] hover:underline"
                            disabled={busyId === inv.id}
                            onClick={() => void onDelete(inv)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {preview && (
        <section className="rounded-xl border border-white/10 bg-[var(--panel)]/70 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">PDF preview</h2>
            <button
              type="button"
              className="text-xs text-[var(--muted)]"
              onClick={() => {
                URL.revokeObjectURL(preview.url);
                setPreview(null);
              }}
            >
              Close
            </button>
          </div>
          <iframe title="PDF" src={preview.url} className="h-[65vh] w-full rounded-md border border-white/10 bg-white" />
        </section>
      )}
    </div>
  );
}
