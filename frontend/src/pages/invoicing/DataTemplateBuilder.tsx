import { useEffect, useState } from "react";

import { downloadDataTemplate, type InvoiceType, type SheetStyle } from "../../api/invoices";
import { templateStorageKey } from "../../lib/sheetStorage";
import { StylePicker } from "./StylePicker";

type TemplateLine = {
  id: string;
  name: string;
  color: string;
  quantity: string;
  perBox: string;
  country: string;
};

type Props = {
  invoiceType: InvoiceType;
  sellerName: string;
  buyerName: string;
  invoiceNo: string;
  invoiceDate: string;
  /** Steps 1–2 not finished yet; the template can still be made, the header is just blank. */
  headerWarning: string | null;
  sheetStyle: SheetStyle;
  onSheetStyleChange: (style: SheetStyle) => void;
};

const storageKey = templateStorageKey;

function newLine(): TemplateLine {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "", color: "", quantity: "", perBox: "", country: "" };
}

function loadSaved(type: InvoiceType): TemplateLine[] {
  try {
    const raw = localStorage.getItem(storageKey(type));
    const data = raw ? (JSON.parse(raw) as TemplateLine[]) : null;
    if (Array.isArray(data) && data.length > 0) return data.map((line) => ({ ...line, color: line.color ?? "" }));
  } catch {
    // ignore unreadable autosave
  }
  return [newLine()];
}

function positiveInt(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function DataTemplateBuilder({
  invoiceType,
  sellerName,
  buyerName,
  invoiceNo,
  invoiceDate,
  headerWarning,
  sheetStyle,
  onSheetStyleChange,
}: Props) {
  const international = invoiceType === "INTERNATIONAL";
  const [lines, setLines] = useState<TemplateLine[]>(() => loadSaved(invoiceType));
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(invoiceType), JSON.stringify(lines));
    } catch {
      // autosave is best effort
    }
  }, [lines, invoiceType]);

  const totals = lines.reduce(
    (acc, line) => {
      const qty = positiveInt(line.quantity);
      const per = positiveInt(line.perBox);
      return {
        units: acc.units + (qty ?? 0),
        boxes: acc.boxes + (qty && per ? Math.ceil(qty / per) : 0),
      };
    },
    { units: 0, boxes: 0 },
  );

  function update(id: string, patch: Partial<TemplateLine>) {
    setLines((list) => list.map((line) => (line.id === id ? { ...line, ...patch } : line)));
    setDone("");
  }

  function remove(id: string) {
    setLines((list) => (list.length > 1 ? list.filter((line) => line.id !== id) : [newLine()]));
  }

  async function generate() {
    const used = lines.filter((line) => line.name.trim() || line.color.trim() || line.quantity || line.perBox);
    if (used.length === 0) {
      setError("Add at least one model");
      return;
    }
    const seen = new Set<string>();
    for (const line of used) {
      const name = line.name.trim().replace(/\s+/g, " ");
      const color = line.color.trim().toUpperCase();
      const label = `${name} ${color}`.trim();
      if (!name) return setError("Every row needs a model name");
      if (seen.has(label.toUpperCase())) return setError(`${label} is listed twice`);
      seen.add(label.toUpperCase());
      if (!positiveInt(line.quantity)) return setError(`Enter the quantity for ${name}`);
      if (!positiveInt(line.perBox)) return setError(`Enter the units per box for ${name}`);
      if (international && !line.country.trim()) return setError(`Enter the country of origin for ${name}`);
    }
    setError("");
    setBusy(true);
    try {
      await downloadDataTemplate({
        invoice_type: invoiceType,
        seller_name: sellerName,
        buyer_name: buyerName,
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        sheet_style: sheetStyle,
        models: used.map((line) => ({
          model_no: line.name.trim().replace(/\s+/g, " "),
          color: line.color.trim().toUpperCase() || null,
          quantity: Number(line.quantity),
          units_per_box: Number(line.perBox),
          country_of_origin: international ? line.country.trim().toUpperCase() : null,
        })),
      });
      setDone(`Template downloaded: ${totals.units} IMEIs in ${totals.boxes} boxes. Fill in the yellow cells, then upload it in Step 4.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 surface p-5">
      <div>
        <h2 className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
          Step 3 — Generate the data template
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Enter each model, its colour, how many units, and how many units go in one box. The Excel you get has the
          summary at the top and one block per model below it, with serial numbers, box numbers, model and colour
          already filled in. Only the IMEIs need to be added.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-normal">Model name</th>
              <th className="py-2 pr-3 font-normal">Colour</th>
              <th className="py-2 pr-3 font-normal">Quantity</th>
              <th className="py-2 pr-3 font-normal">Units per box</th>
              <th className="py-2 pr-3 font-normal">Boxes</th>
              {international && <th className="py-2 pr-3 font-normal">Country of origin</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const qty = positiveInt(line.quantity);
              const per = positiveInt(line.perBox);
              return (
                <tr key={line.id} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3">
                    <input
                      className="w-full px-3 py-1.5"
                      placeholder="GALAXY S25 FE 8/256"
                      value={line.name}
                      onChange={(e) => update(line.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-28 px-2 py-1.5"
                      placeholder="BLACK"
                      value={line.color}
                      onChange={(e) => update(line.id, { color: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={1}
                      className="w-24 px-2 py-1.5 font-mono"
                      placeholder="150"
                      value={line.quantity}
                      onChange={(e) => update(line.id, { quantity: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={1}
                      className="w-24 px-2 py-1.5 font-mono"
                      placeholder="10"
                      value={line.perBox}
                      onChange={(e) => update(line.id, { perBox: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3 font-mono">{qty && per ? Math.ceil(qty / per) : "—"}</td>
                  {international && (
                    <td className="py-2 pr-3">
                      <input
                        className="w-36 px-2 py-1.5"
                        placeholder="INDIA"
                        value={line.country}
                        onChange={(e) => update(line.id, { country: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      title="Remove this model"
                      onClick={() => remove(line.id)}
                      className="rounded px-2 py-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--bad)]"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-[var(--line)] font-medium">
              <td className="py-2 pr-3">Total</td>
              <td />
              <td className="py-2 pr-3 font-mono">{totals.units}</td>
              <td />
              <td className="py-2 pr-3 font-mono">{totals.boxes}</td>
              {international && <td />}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-[var(--muted)]">
          Sheet style — used for this template and for the Excel and PDF made from it.
        </p>
        <StylePicker value={sheetStyle} onChange={onSheetStyleChange} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setLines((list) => [...list, newLine()])} className="btn-quiet">
          + Add model
        </button>
        <button type="button" disabled={busy} onClick={() => void generate()} className="btn-gold disabled:opacity-40">
          {busy ? "Working…" : "Generate template"}
        </button>
        {headerWarning && (
          <span className="text-xs text-[var(--warn)]">{headerWarning} first so they print on the sheet.</span>
        )}
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      {done && <p className="text-sm text-[var(--ok)]">{done}</p>}
    </section>
  );
}
