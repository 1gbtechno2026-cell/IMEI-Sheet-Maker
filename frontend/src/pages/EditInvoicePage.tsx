import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../api/client";
import {
  downloadInvoiceExcel,
  getInvoice,
  parseUpload,
  updateInvoice,
  validateRows,
  type InvoiceRecord,
  type InvoiceRow,
  type InvoiceType,
  type ParseUploadResult,
} from "../api/invoices";
import { useAuth } from "../auth/AuthContext";
import { GstSelect, defaultGstId } from "./invoicing/GstSelect";
import { InvoiceHistoryPanel } from "./invoicing/InvoiceHistoryPanel";
import { PartySelect } from "./invoicing/PartySelect";
import { PdfPreviewPanel } from "./invoicing/PdfPreviewPanel";
import { RowsVirtualTable } from "./invoicing/RowsVirtualTable";

function canEdit(role: string, invoice: InvoiceRecord, userId: number | undefined) {
  if (invoice.is_deleted) return false;
  if (role === "VIEWER") return false;
  if (role === "ADMIN" || role === "MANAGER") return true;
  if (role === "OPERATOR") return invoice.created_by === userId;
  return false;
}

export function EditInvoicePage() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [buyerGsts, setBuyerGsts] = useState<InvoiceRecord["buyer_gsts"]>([]);
  const [sellerGstId, setSellerGstId] = useState<number | null>(null);
  const [buyerGstId, setBuyerGstId] = useState<number | null>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<{ model_no: string; quantity: number }[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [canSave, setCanSave] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseInfo, setParseInfo] = useState<ParseUploadResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [columnMap, setColumnMap] = useState({
    model_no: "",
    imei: "",
    box_no: "",
    country_of_origin: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const invoiceType = (invoice?.invoice_type || "LOCAL") as InvoiceType;

  const runValidate = useCallback(
    async (nextRows: InvoiceRow[]) => {
      if (!invoice) return;
      if (nextRows.length === 0) {
        setRows([]);
        setSummary([]);
        setValidCount(0);
        setErrorCount(0);
        setCanSave(false);
        return;
      }
      const res = await validateRows(invoiceType, nextRows, invoice.id);
      setRows(res.rows);
      setSummary(res.summary);
      setValidCount(res.valid_count);
      setErrorCount(res.error_count);
      setCanSave(res.can_save);
    },
    [invoice, invoiceType],
  );

  useEffect(() => {
    if (!Number.isFinite(invoiceId)) return;
    setLoading(true);
    void getInvoice(invoiceId)
      .then(async (inv) => {
        setInvoice(inv);
        setInvoiceNo(inv.invoice_no);
        setBuyerId(inv.buyer_id);
        setBuyerGsts(inv.buyer_gsts || []);
        setSellerGstId(defaultGstId(inv.seller_gsts, inv.seller_gst_id ?? null));
        setBuyerGstId(defaultGstId(inv.buyer_gsts, inv.buyer_gst_id ?? null));
        setInvoiceDate(inv.invoice_date);
        setFileName(inv.source_file_name);
        const initialRows: InvoiceRow[] = (inv.items || []).map((it, idx) => ({
          row_index: idx + 1,
          model_no: it.model_no,
          color: it.color,
          imei: it.imei,
          box_no: it.box_no,
          country_of_origin: it.country_of_origin,
        }));
        const res = await validateRows(inv.invoice_type as InvoiceType, initialRows, inv.id);
        setRows(res.rows);
        setSummary(res.summary);
        setValidCount(res.valid_count);
        setErrorCount(res.error_count);
        setCanSave(res.can_save);
      })
      .catch((err) => setError(err instanceof ApiError ? err.detail : String(err)))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return <p className="text-[var(--muted)]">Loading invoice…</p>;
  }
  if (!invoice) {
    return <p className="text-[var(--bad)]">{error || "Invoice not found"}</p>;
  }
  if (!canEdit(user?.role || "", invoice, user?.id)) {
    return <Navigate to="/history" replace />;
  }

  async function onFileSelected(file: File | null) {
    if (!file || !invoice) return;
    setBusy(true);
    setError("");
    setPendingFile(file);
    try {
      const parsed = await parseUpload(file, invoiceType);
      setParseInfo(parsed);
      setFileName(parsed.source_file_name || file.name);
      setColumnMap({
        model_no: parsed.detected_map.model_no || "",
        imei: parsed.detected_map.imei || "",
        box_no: parsed.detected_map.box_no || "",
        country_of_origin: parsed.detected_map.country_of_origin || "",
      });
      if (!parsed.needs_manual_map) {
        await runValidate(parsed.rows);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function applyColumnMap() {
    if (!pendingFile || !invoice) return;
    setBusy(true);
    try {
      const parsed = await parseUpload(pendingFile, invoiceType, {
        model_no: columnMap.model_no || undefined,
        imei: columnMap.imei || undefined,
        box_no: columnMap.box_no || undefined,
        country_of_origin: columnMap.country_of_origin || undefined,
      });
      setParseInfo(parsed);
      if (!parsed.needs_manual_map) await runValidate(parsed.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!invoice || !buyerId) return;
    setBusy(true);
    setError("");
    try {
      const res = await validateRows(invoiceType, rows, invoice.id);
      setRows(res.rows);
      setSummary(res.summary);
      setValidCount(res.valid_count);
      setErrorCount(res.error_count);
      setCanSave(res.can_save);
      if (!res.can_save) {
        setError(`Fix ${res.error_count} row error(s) before saving`);
        return;
      }
      const updated = await updateInvoice(invoice.id, {
        invoice_no: invoiceNo.trim(),
        buyer_id: buyerId,
        seller_gst_id: sellerGstId,
        buyer_gst_id: buyerGstId,
        invoice_date: invoiceDate,
        source_file_name: fileName,
        rows: res.rows.map((r) => ({
          row_index: r.row_index,
          model_no: r.model_no,
          color: r.color,
          imei: r.imei,
          box_no: r.box_no,
          country_of_origin: r.country_of_origin,
        })),
        regenerate_pdf: true,
      });
      setInvoice(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--muted)] uppercase">Edit invoice</p>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">{invoice.invoice_no}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Saving regenerates the PDF and Excel. Every change is listed in the edit history below.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link to="/history" className="rounded-md border border-[var(--line)] px-3 py-1.5 hover:bg-[var(--hover)]">
            Back to History
          </Link>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 hover:bg-[var(--hover)]"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-sm">{error}</p>
      )}

      <section className="grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Seller</span>
          <input
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm"
            value={invoice.seller_name || `Company #${invoice.seller_id}`}
            disabled
          />
        </label>
        <PartySelect
          role="buyer"
          label="Buyer"
          value={buyerId}
          excludeId={invoice.seller_id}
          onChange={(id, company) => {
            setBuyerId(id);
            setBuyerGsts(company?.gsts || []);
            setBuyerGstId(defaultGstId(company?.gsts, null));
          }}
        />
        <GstSelect
          label="Seller GST"
          gsts={invoice.seller_gsts || []}
          value={sellerGstId}
          onChange={setSellerGstId}
        />
        <GstSelect label="Buyer GST" gsts={buyerGsts || []} value={buyerGstId} onChange={setBuyerGstId} />
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Invoice number</span>
          <input
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 font-mono text-sm"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Invoice date</span>
          <input
            type="date"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5">
        <h2 className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">Line items</h2>
        <p className="text-xs text-[var(--muted)]">
          To change IMEIs, download the current data, edit it in Excel (keep the summary quantities in
          step with the IMEIs), and upload it here.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              void downloadInvoiceExcel(invoice.id, invoice.invoice_no).catch((err) =>
                setError(err instanceof Error ? err.message : String(err)),
              )
            }
            className="btn-gold"
          >
            Download current data
          </button>
          <input
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            onChange={(e) => void onFileSelected(e.target.files?.[0] || null)}
          />
        </div>
        {parseInfo?.needs_manual_map && (
          <div className="grid gap-2 md:grid-cols-3">
            {(["model_no", "imei", "box_no", "country_of_origin"] as const).map((key) => {
              if (invoiceType !== "INTERNATIONAL" && (key === "box_no" || key === "country_of_origin")) {
                return null;
              }
              return (
                <select
                  key={key}
                  className="rounded-md border border-[var(--line)] bg-[var(--field)] px-2 py-2 text-sm"
                  value={columnMap[key]}
                  onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value }))}
                >
                  <option value="">{key}</option>
                  {parseInfo.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              );
            })}
            <button
              type="button"
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white"
              onClick={() => void applyColumnMap()}
            >
              Apply mapping
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-sm">
          <span>
            Rows <span className="font-mono">{rows.length}</span>
          </span>
          <span className="text-[var(--ok)]">
            Valid <span className="font-mono">{validCount}</span>
          </span>
          <span className="text-[var(--bad)]">
            Errors <span className="font-mono">{errorCount}</span>
          </span>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
            onClick={() => void runValidate(rows)}
          >
            Re-validate
          </button>
        </div>
        <RowsVirtualTable
          rows={rows}
          invoiceType={invoiceType}
          onChangeRow={(i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))}
          onRemoveRow={(i) => void runValidate(rows.filter((_, idx) => idx !== i))}
        />
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="min-w-[16rem] text-left text-sm">
            <thead className="bg-[var(--field)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.model_no} className="border-t border-[var(--line)]">
                  <td className="px-3 py-1 font-mono text-xs">{s.model_no}</td>
                  <td className="px-3 py-1 font-mono">{s.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={busy || !canSave || !buyerId}
          onClick={() => void onSave()}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save + regenerate PDF & Excel"}
        </button>
      </div>

      {invoice.pdf_path && <PdfPreviewPanel invoice={invoice} onUpdated={setInvoice} />}

      <InvoiceHistoryPanel invoiceId={invoice.id} refreshKey={invoice} />
    </div>
  );
}
