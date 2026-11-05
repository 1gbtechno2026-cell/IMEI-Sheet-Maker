import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../api/client";
import type { Company } from "../api/companies";
import {
  finalizeInvoice,
  parseUpload,
  saveDraft,
  validateRows,
  type DraftInvoice,
  type InvoiceRow,
  type InvoiceType,
  type ParseUploadResult,
} from "../api/invoices";
import { useInvoiceMode } from "../auth/ModeContext";
import { ModeToggle } from "../layout/ModeToggle";
import { scanStorageKey, templateStorageKey } from "../lib/sheetStorage";
import { DataTemplateBuilder } from "./invoicing/DataTemplateBuilder";
import { GstSelect, defaultGstId } from "./invoicing/GstSelect";
import { PartySelect } from "./invoicing/PartySelect";
import { PdfPreviewPanel } from "./invoicing/PdfPreviewPanel";
import { RowsVirtualTable } from "./invoicing/RowsVirtualTable";
import { ScanSheet, type ScanCreateResult } from "./invoicing/ScanSheet";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/*
 * What survives leaving this page:
 *  - While a sheet is in progress, Steps 1–4 are kept (parties, number, date, Step 3 models,
 *    the uploaded rows, scanned IMEIs), so switching sidebar tabs loses nothing.
 *  - Once "Create Excel & PDF" succeeds, the saved work is forgotten: the result stays on
 *    screen, and the next visit starts empty (the sheet itself is in History).
 *  - Reset clears everything at once, for both Local and International.
 */
const PAGE_KEY = "imeiDataMaker.sheetPage";
const uploadKey = (type: InvoiceType) => `imeiDataMaker.upload.${type}`;
const MODES: InvoiceType[] = ["LOCAL", "INTERNATIONAL"];

type SavedPage = {
  sellerId: number | null;
  seller: Company | null;
  sellerGstId: number | null;
  buyerId: number | null;
  buyer: Company | null;
  buyerGstId: number | null;
  invoiceNo: string;
  invoiceDate: string;
  source: "upload" | "scan";
};

type SavedUpload = {
  fileName: string | null;
  rows: InvoiceRow[];
  sheetSummary: { model_no: string; quantity: number }[] | null;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // keeping work across tabs is best effort
  }
}

/** Drop saved work. With no mode, everything for both modes and the shared page fields. */
function forgetWork(mode?: InvoiceType) {
  writeJson(PAGE_KEY, null);
  for (const type of mode ? [mode] : MODES) {
    writeJson(uploadKey(type), null);
    writeJson(templateStorageKey(type), null);
    if (!mode) writeJson(scanStorageKey(type), null);
  }
}

function stripRow(r: InvoiceRow): InvoiceRow {
  return {
    row_index: r.row_index,
    model_no: r.model_no,
    color: r.color,
    imei: r.imei,
    box_no: r.box_no,
    country_of_origin: r.country_of_origin,
  };
}

export function InvoicingPage() {
  const { mode } = useInvoiceMode();
  const invoiceType = mode;
  const international = invoiceType === "INTERNATIONAL";

  const [initial] = useState(() => readJson<SavedPage>(PAGE_KEY));
  const [sellerId, setSellerId] = useState<number | null>(initial?.sellerId ?? null);
  const [seller, setSeller] = useState<Company | null>(initial?.seller ?? null);
  const [sellerGstId, setSellerGstId] = useState<number | null>(initial?.sellerGstId ?? null);
  const [buyerId, setBuyerId] = useState<number | null>(initial?.buyerId ?? null);
  const [buyer, setBuyer] = useState<Company | null>(initial?.buyer ?? null);
  const [buyerGstId, setBuyerGstId] = useState<number | null>(initial?.buyerGstId ?? null);
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate || todayISO());
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseInfo, setParseInfo] = useState<ParseUploadResult | null>(null);
  const [columnMap, setColumnMap] = useState({
    model_no: "",
    imei: "",
    box_no: "",
    country_of_origin: "",
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<{ model_no: string; quantity: number }[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [canSave, setCanSave] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<DraftInvoice | null>(null);
  const [source, setSource] = useState<"upload" | "scan">(initial?.source ?? "upload");
  const [sheetSummary, setSheetSummary] = useState<SavedUpload["sheetSummary"]>(null);
  // Bumped by Reset to remount Step 3, the scan grid and the file picker empty.
  const [resetKey, setResetKey] = useState(0);

  const hasWork = Boolean(
    sellerId || buyerId || invoiceNo.trim() || rows.length > 0 || saved,
  );

  // Keep Steps 1–2 while a sheet is in progress (not after it is created).
  useEffect(() => {
    if (saved?.status === "FINAL") return;
    const page: SavedPage = {
      sellerId,
      seller,
      sellerGstId,
      buyerId,
      buyer,
      buyerGstId,
      invoiceNo,
      invoiceDate,
      source,
    };
    writeJson(PAGE_KEY, page);
  }, [sellerId, seller, sellerGstId, buyerId, buyer, buyerGstId, invoiceNo, invoiceDate, source, saved]);

  const runValidate = useCallback(
    async (nextRows: InvoiceRow[]) => {
      if (nextRows.length === 0) {
        setRows([]);
        setSummary([]);
        setValidCount(0);
        setErrorCount(0);
        setCanSave(false);
        return;
      }
      const res = await validateRows(invoiceType, nextRows);
      setRows(res.rows);
      setSummary(res.summary);
      setValidCount(res.valid_count);
      setErrorCount(res.error_count);
      setCanSave(res.can_save);
      return res;
    },
    [invoiceType],
  );

  function rememberUpload(nextRows: InvoiceRow[], name: string | null, perModel: SavedUpload["sheetSummary"]) {
    const upload: SavedUpload = { fileName: name, rows: nextRows.map(stripRow), sheetSummary: perModel };
    writeJson(uploadKey(invoiceType), nextRows.length ? upload : null);
  }

  // Each mode keeps its own uploaded rows; show that mode's rows when switching.
  useEffect(() => {
    const upload = readJson<SavedUpload>(uploadKey(invoiceType));
    setParseInfo(null);
    setPendingFile(null);
    setSaved(null);
    setError("");
    setFileName(upload?.fileName ?? null);
    setSheetSummary(upload?.sheetSummary ?? null);
    void runValidate(upload?.rows ?? []).catch((err) =>
      setError(err instanceof ApiError ? err.detail : String(err)),
    );
  }, [invoiceType, runValidate]);

  function resetAll(ask: boolean) {
    if (ask && hasWork && !window.confirm("Clear this IMEI sheet? Parties, Step 3 models, the upload and scanned IMEIs are cleared for Local and International.")) {
      return;
    }
    forgetWork();
    setSellerId(null);
    setSeller(null);
    setSellerGstId(null);
    setBuyerId(null);
    setBuyer(null);
    setBuyerGstId(null);
    setInvoiceNo("");
    setInvoiceDate(todayISO());
    setFileName(null);
    setParseInfo(null);
    setPendingFile(null);
    setSheetSummary(null);
    setRows([]);
    setSummary([]);
    setValidCount(0);
    setErrorCount(0);
    setCanSave(false);
    setSaved(null);
    setError("");
    setSource("upload");
    setResetKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  }

  function onCreated(invoice: DraftInvoice) {
    setSaved(invoice);
    if (invoice.status === "FINAL") forgetWork(invoiceType);
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSaved(null);
    setPendingFile(file);
    try {
      const parsed = await parseUpload(file, invoiceType);
      setParseInfo(parsed);
      setSheetSummary(parsed.sheet_summary ?? null);
      setFileName(parsed.source_file_name || file.name);
      setColumnMap({
        model_no: parsed.detected_map.model_no || "",
        imei: parsed.detected_map.imei || "",
        box_no: parsed.detected_map.box_no || "",
        country_of_origin: parsed.detected_map.country_of_origin || "",
      });
      if (!parsed.needs_manual_map) {
        await runValidate(parsed.rows);
        rememberUpload(parsed.rows, parsed.source_file_name || file.name, parsed.sheet_summary ?? null);
      } else {
        setRows([]);
        setCanSave(false);
      }
    } catch (err) {
      setRows([]);
      setSheetSummary(null);
      rememberUpload([], null, null);
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function applyColumnMap() {
    if (!pendingFile) return;
    setBusy(true);
    setError("");
    try {
      const parsed = await parseUpload(pendingFile, invoiceType, {
        model_no: columnMap.model_no || undefined,
        imei: columnMap.imei || undefined,
        box_no: columnMap.box_no || undefined,
        country_of_origin: columnMap.country_of_origin || undefined,
      });
      setParseInfo(parsed);
      if (parsed.needs_manual_map) {
        setError("Still missing required columns — check mapping.");
        setRows([]);
      } else {
        await runValidate(parsed.rows);
        rememberUpload(parsed.rows, fileName, null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onChangeRow(index: number, patch: Partial<InvoiceRow>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setRows(next);
  }

  async function revalidateNow() {
    setBusy(true);
    setError("");
    try {
      const res = await runValidate(rows);
      rememberUpload(res?.rows ?? rows, fileName, sheetSummary);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onRemoveRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    rememberUpload(next, fileName, sheetSummary);
    void runValidate(next).catch((err) =>
      setError(err instanceof ApiError ? err.detail : String(err)),
    );
  }

  function headerError(): string | null {
    if (!sellerId || !buyerId) return "Select seller and buyer";
    if (!invoiceNo.trim()) return "Type the invoice number";
    if ((seller?.gsts?.length || 0) > 0 && !sellerGstId) return "Select the seller GST";
    if ((buyer?.gsts?.length || 0) > 0 && !buyerGstId) return "Select the buyer GST";
    if (sellerId === buyerId) return "Seller and buyer must be different";
    return null;
  }

  /** Scan flow: validate, save, and render PDF + Excel in one go. */
  async function onCreateFromScan(scanRows: InvoiceRow[]): Promise<ScanCreateResult> {
    const problem = headerError();
    if (problem || !sellerId || !buyerId) {
      return { ok: false, message: `${problem || "Select seller and buyer"} (Steps 1–2 above)` };
    }
    setBusy(true);
    setError("");
    try {
      const res = await validateRows(invoiceType, scanRows);
      if (!res.can_save) {
        return {
          ok: false,
          message: `Fix ${res.error_count} IMEI error(s)`,
          badRows: res.rows.filter((r) => !r.ok),
        };
      }
      const draft = await saveDraft({
        invoice_no: invoiceNo.trim(),
        invoice_type: invoiceType,
        seller_id: sellerId,
        buyer_id: buyerId,
        seller_gst_id: sellerGstId,
        buyer_gst_id: buyerGstId,
        invoice_date: invoiceDate,
        source_file_name: "Scanned in app",
        rows: res.rows.map((r) => ({
          row_index: r.row_index,
          model_no: r.model_no,
          color: r.color,
          imei: r.imei,
          box_no: r.box_no,
          country_of_origin: r.country_of_origin,
        })),
      });
      setSaved(draft);
      onCreated(await finalizeInvoice(draft.id));
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof ApiError ? err.detail : String(err) };
    } finally {
      setBusy(false);
    }
  }

  /** Upload flow: save the rows, then render the PDF and Excel. */
  async function onCreateFromUpload() {
    const problem = headerError();
    if (problem || !sellerId || !buyerId) {
      setError(problem || "Select seller and buyer");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Re-validate immediately before save
      const res = await validateRows(invoiceType, rows);
      setRows(res.rows);
      setSummary(res.summary);
      setValidCount(res.valid_count);
      setErrorCount(res.error_count);
      setCanSave(res.can_save);
      if (!res.can_save) {
        setError(`Fix ${res.error_count} row error(s) first`);
        return;
      }
      const draft = await saveDraft({
        invoice_no: invoiceNo.trim(),
        invoice_type: invoiceType,
        seller_id: sellerId,
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
      });
      setSaved(draft);
      onCreated(await finalizeInvoice(draft.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFinalize() {
    if (!saved) {
      setError("Save a DRAFT first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onCreated(await finalizeInvoice(saved.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-[var(--accent)] uppercase">With the invoice</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">IMEI sheet</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Pick the parties, make the data template, fill in the IMEIs, then upload it. The app
            creates the Excel and the PDF from it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => resetAll(true)}
            className="btn-quiet disabled:opacity-40"
            title="Clear everything on this page and start a new IMEI sheet"
          >
            Reset
          </button>
          <ModeToggle />
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-md border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-3 py-2 text-sm">
          Invoice <span className="font-mono">{saved.invoice_no}</span> · {saved.item_count} units ·{" "}
          status {saved.status}
        </p>
      )}

      <section className="grid gap-4 surface p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
          Step 1 — Seller & buyer
        </h2>
        <PartySelect
          role="seller"
          label="Seller"
          value={sellerId}
          excludeId={buyerId}
          onChange={(id, c) => {
            setSellerId(id);
            setSeller(c);
            setSellerGstId(defaultGstId(c?.gsts, null));
          }}
        />
        <PartySelect
          role="buyer"
          label="Buyer"
          value={buyerId}
          excludeId={sellerId}
          onChange={(id, c) => {
            setBuyerId(id);
            setBuyer(c);
            setBuyerGstId(defaultGstId(c?.gsts, null));
          }}
        />
        <GstSelect label="Seller GST" gsts={seller?.gsts || []} value={sellerGstId} onChange={setSellerGstId} />
        <GstSelect label="Buyer GST" gsts={buyer?.gsts || []} value={buyerGstId} onChange={setBuyerGstId} />
        <p className="md:col-span-2 text-xs text-[var(--muted)]">
          The chosen GST prints in the header. The seller’s logo sits in that header, and the
          sign-and-stamp image sits at the bottom right.
        </p>
      </section>

      <section className="grid gap-4 surface p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
          Step 2 — Invoice number and date
        </h2>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Invoice number</span>
          <input
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 font-mono"
            placeholder={international ? "EXPORT/26-27/7" : "Type the invoice number"}
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

      <DataTemplateBuilder
        key={`${invoiceType}-${resetKey}`}
        invoiceType={invoiceType}
        sellerName={seller?.name || ""}
        buyerName={buyer?.name || ""}
        invoiceNo={invoiceNo}
        invoiceDate={invoiceDate}
        headerWarning={headerError()}
      />

      <section className="space-y-4 surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
            Step 4 — {source === "upload" ? "Upload the filled data sheet" : "Create by scanning"}
          </h2>
          <div className="flex rounded-full border border-[var(--line)] p-1 text-sm">
            {(
              [
                ["upload", "Upload filled sheet"],
                ["scan", "Create by scanning"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSource(key)}
                className={`rounded-full px-3 py-1.5 ${
                  source === key ? "bg-[var(--chip)] ring-1 ring-[var(--accent)]/60" : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {source === "scan" && (
          <ScanSheet key={`${invoiceType}-${resetKey}`} invoiceType={invoiceType} busy={busy} onCreate={onCreateFromScan} />
        )}

        {source === "upload" && (
          <>
            <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--accent)]/40 bg-[var(--field)] px-4 py-4">
              <span>
                <span className="block text-sm font-medium">Choose the filled data sheet</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {fileName ||
                    "The template from Step 3 with the IMEIs filled in. Each model must have exactly the quantity in its summary."}
                </span>
              </span>
              <span className="btn-quiet">Browse</span>
              <input
                key={`${fileName}-${resetKey}`}
                className="sr-only"
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv"
                onChange={(e) => void onFileSelected(e.target.files?.[0] || null)}
              />
            </label>

            {parseInfo?.needs_manual_map && (
              <div className="grid gap-3 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-4 md:grid-cols-3">
                <p className="md:col-span-3 text-sm">
                  Could not auto-detect columns. Map headers manually:
                </p>
                {(["model_no", "imei", "box_no", "country_of_origin"] as const).map((key) => {
                  if (!international && (key === "box_no" || key === "country_of_origin")) return null;
                  return (
                    <label key={key} className="text-sm">
                      <span className="mb-1 block text-[var(--muted)]">{key}</span>
                      <select
                        className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-2 py-2"
                        value={columnMap[key]}
                        onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value }))}
                      >
                        <option value="">—</option>
                        {parseInfo.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
                <button
                  type="button"
                  onClick={() => void applyColumnMap()}
                  className="md:col-span-3 justify-self-start rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white"
                >
                  Apply mapping
                </button>
              </div>
            )}

            {rows.length > 0 && (
              <>
                {sheetSummary && (
                  <p className="rounded-xl border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-3 py-2 text-sm">
                    IMEI counts match the sheet’s summary:{" "}
                    {sheetSummary.map((m) => `${m.model_no} ${m.quantity}`).join(" · ")}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>
                    Rows: <span className="font-mono">{rows.length}</span>
                  </span>
                  <span className="text-[var(--ok)]">
                    Valid: <span className="font-mono">{validCount}</span>
                  </span>
                  <span className="text-[var(--bad)]">
                    Errors: <span className="font-mono">{errorCount}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void revalidateNow()}
                    className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--hover)]"
                  >
                    Re-validate
                  </button>
                </div>
                {errorCount > 0 && (
                  <ul className="space-y-1 rounded-xl border border-[var(--bad)]/30 bg-[var(--bad)]/10 px-3 py-2 text-sm text-[var(--bad)]">
                    {[...new Set(rows.flatMap((r) => r.errors || []))].map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}

                <RowsVirtualTable
                  rows={rows}
                  invoiceType={invoiceType}
                  onChangeRow={(i, patch) => void onChangeRow(i, patch)}
                  onRemoveRow={onRemoveRow}
                />

                <div>
                  <h3 className="mb-2 text-sm font-medium">Summary by model (valid rows)</h3>
                  <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
                    <table className="min-w-[20rem] text-left text-sm">
                      <thead className="bg-[var(--field)] text-[var(--muted)]">
                        <tr>
                          <th className="px-3 py-2">Model No</th>
                          <th className="px-3 py-2">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map((s) => (
                          <tr key={s.model_no} className="border-t border-[var(--line)]">
                            <td className="px-3 py-1.5 font-mono text-xs">{s.model_no}</td>
                            <td className="px-3 py-1.5 font-mono">{s.quantity}</td>
                          </tr>
                        ))}
                        {summary.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-[var(--muted)]">
                              No valid rows yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {source === "upload" && saved?.status !== "FINAL" && (
        <div className="flex flex-wrap justify-end gap-3 pb-4">
          <button
            type="button"
            disabled={busy || (!saved && (!canSave || !sellerId || !buyerId))}
            onClick={() => void (saved ? onFinalize() : onCreateFromUpload())}
            className="btn-gold disabled:opacity-40"
          >
            {busy ? "Working…" : saved ? "Retry Excel & PDF" : "Create Excel & PDF"}
          </button>
        </div>
      )}

      {saved && (saved.pdf_path || saved.status === "FINAL") && (
        <>
          <PdfPreviewPanel invoice={saved} onUpdated={setSaved} />
          <div className="flex justify-end pb-8">
            <button type="button" onClick={() => resetAll(false)} className="btn-gold">
              Start the next IMEI sheet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
