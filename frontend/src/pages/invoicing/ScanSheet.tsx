import { useEffect, useRef, useState } from "react";

import type { InvoiceRow, InvoiceType } from "../../api/invoices";
import { imeiError, normalizeImei } from "../../lib/imei";

type ScanModel = {
  id: string;
  name: string;
  imeis: string[];
  perBox: string;
  country: string;
};

type Stage = "models" | "scan" | "done";

export type ScanCreateResult = { ok: true } | { ok: false; message: string; badRows?: InvoiceRow[] };

type Props = {
  invoiceType: InvoiceType;
  busy: boolean;
  onCreate: (rows: InvoiceRow[]) => Promise<ScanCreateResult>;
};

const storageKey = (type: InvoiceType) => `invoiceMaker.scanSheet.${type}`;

function loadSaved(type: InvoiceType): { stage: Stage; models: ScanModel[] } {
  try {
    const raw = localStorage.getItem(storageKey(type));
    if (raw) {
      const data = JSON.parse(raw) as { stage?: Stage; models?: ScanModel[] };
      if (Array.isArray(data.models)) {
        return { stage: data.stage === "scan" ? "scan" : "models", models: data.models };
      }
    }
  } catch {
    // ignore unreadable autosave
  }
  return { stage: "models", models: [] };
}

function boxesFor(quantity: number, perBox: string): number | null {
  const per = Number(perBox);
  if (!Number.isInteger(per) || per <= 0) return null;
  return Math.ceil(quantity / per);
}

let audio: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = ok ? 1200 : 220;
    osc.type = ok ? "sine" : "square";
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (ok ? 0.06 : 0.35));
  } catch {
    // sound is optional
  }
}

export function ScanSheet({ invoiceType, busy, onCreate }: Props) {
  const international = invoiceType === "INTERNATIONAL";
  const [initial] = useState(() => loadSaved(invoiceType));
  const [stage, setStage] = useState<Stage>(initial.stage);
  const [models, setModels] = useState<ScanModel[]>(initial.models);
  const [newName, setNewName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(initial.models[0]?.id ?? null);
  const [scanValue, setScanValue] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showBoxes, setShowBoxes] = useState(false);
  const [popupError, setPopupError] = useState("");
  const [badImeis, setBadImeis] = useState<Map<string, string>>(new Map());
  const scanRef = useRef<HTMLInputElement>(null);
  const nextCellRef = useRef<HTMLTableCellElement>(null);

  const active = models.find((m) => m.id === activeId) || null;
  const totalScanned = models.reduce((sum, m) => sum + m.imeis.length, 0);
  const height = Math.max(0, ...models.map((m) => m.imeis.length)) + 1;

  useEffect(() => {
    try {
      if (stage === "done") localStorage.removeItem(storageKey(invoiceType));
      else localStorage.setItem(storageKey(invoiceType), JSON.stringify({ stage, models }));
    } catch {
      // autosave is best effort
    }
  }, [stage, models, invoiceType]);

  useEffect(() => {
    nextCellRef.current?.scrollIntoView({ block: "nearest" });
  }, [active?.imeis.length, activeId]);

  function addModel() {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (models.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setMessage({ ok: false, text: `${name} is already in the list` });
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const model: ScanModel = { id, name, imeis: [], perBox: "", country: "" };
    setModels((list) => [...list, model]);
    setNewName("");
    setMessage(null);
    if (!activeId) setActiveId(model.id);
  }

  function removeModel(model: ScanModel) {
    if (model.imeis.length > 0 && !window.confirm(`Remove ${model.name} and its ${model.imeis.length} scanned IMEIs?`)) {
      return;
    }
    setModels((list) => list.filter((m) => m.id !== model.id));
    if (activeId === model.id) setActiveId(null);
  }

  function selectColumn(id: string) {
    setActiveId(id);
    setMessage(null);
    setTimeout(() => scanRef.current?.focus(), 0);
  }

  function handleScan(raw: string) {
    setScanValue("");
    const imei = normalizeImei(raw);
    if (!imei) return;
    if (!active) {
      beep(false);
      setMessage({ ok: false, text: "Click a model header first, then scan" });
      return;
    }
    const problem = imeiError(imei);
    if (problem) {
      beep(false);
      setMessage({ ok: false, text: `${imei}: ${problem}` });
      return;
    }
    for (const m of models) {
      const at = m.imeis.indexOf(imei);
      if (at >= 0) {
        beep(false);
        setMessage({ ok: false, text: `${imei} is already scanned under ${m.name} (row ${at + 1})` });
        return;
      }
    }
    beep(true);
    setModels((list) => list.map((m) => (m.id === active.id ? { ...m, imeis: [...m.imeis, imei] } : m)));
    setMessage({ ok: true, text: `${active.name} · ${active.imeis.length + 1} scanned` });
  }

  function removeImei(modelId: string, index: number) {
    const imei = models.find((m) => m.id === modelId)?.imeis[index];
    setModels((list) =>
      list.map((m) => (m.id === modelId ? { ...m, imeis: m.imeis.filter((_, i) => i !== index) } : m)),
    );
    if (imei && badImeis.has(imei)) {
      const next = new Map(badImeis);
      next.delete(imei);
      setBadImeis(next);
    }
    scanRef.current?.focus();
  }

  function updateModel(id: string, patch: Partial<ScanModel>) {
    setModels((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function startOver() {
    if (stage !== "done" && totalScanned > 0 && !window.confirm("Clear all models and scanned IMEIs?")) return;
    setModels([]);
    setActiveId(null);
    setBadImeis(new Map());
    setMessage(null);
    setStage("models");
  }

  async function create() {
    const filled = models.filter((m) => m.imeis.length > 0);
    if (filled.length === 0) {
      setPopupError("Scan at least one IMEI");
      return;
    }
    for (const m of filled) {
      if (boxesFor(m.imeis.length, m.perBox) == null) {
        setPopupError(`Enter how many units go in one box for ${m.name}`);
        return;
      }
      if (international && !m.country.trim()) {
        setPopupError(`Enter the country of origin for ${m.name}`);
        return;
      }
    }
    setPopupError("");
    // Box numbers restart at 1 for each model.
    const rows: InvoiceRow[] = filled.flatMap((m) => {
      const per = Number(m.perBox);
      return m.imeis.map((imei, i) => ({
        row_index: i + 1,
        model_no: m.name,
        imei,
        box_no: String(Math.floor(i / per) + 1),
        country_of_origin: international ? m.country.trim() : null,
      }));
    });
    const result = await onCreate(rows);
    if (result.ok) {
      setShowBoxes(false);
      setBadImeis(new Map());
      setStage("done");
      return;
    }
    if (result.badRows && result.badRows.length > 0) {
      setBadImeis(new Map(result.badRows.map((r) => [r.imei, (r.errors || []).join("; ")])));
      setShowBoxes(false);
      setMessage({
        ok: false,
        text: `${result.badRows.length} IMEI(s) cannot be used — marked in red. Remove them and press Next again.`,
      });
      return;
    }
    setPopupError(result.message);
  }

  if (stage === "done") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-4 py-4 text-sm">
        <span>Saved. The Excel and PDF are ready below.</span>
        <button type="button" className="btn-quiet" onClick={startOver}>
          Start a new sheet
        </button>
      </div>
    );
  }

  const addModelRow = (
    <div className="flex flex-wrap gap-2">
      <input
        className="min-w-[16rem] flex-1 px-3 py-2"
        placeholder="Model name, e.g. GALAXY S25 FE 8/256 BLACK"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addModel();
          }
        }}
      />
      <button type="button" className="btn-quiet" onClick={addModel}>
        + Add model
      </button>
    </div>
  );

  if (stage === "models") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Add every model in this shipment. Each model becomes a column you scan into.
        </p>
        {addModelRow}
        {message && !message.ok && <p className="text-sm text-[var(--bad)]">{message.text}</p>}
        {models.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm"
              >
                <span className="font-mono text-xs">{m.name}</span>
                {m.imeis.length > 0 && <span className="text-xs text-[var(--muted)]">{m.imeis.length}</span>}
                <button
                  type="button"
                  className="text-[var(--muted)] hover:text-[var(--bad)]"
                  onClick={() => removeModel(m)}
                  aria-label={`Remove ${m.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-gold disabled:opacity-40"
            disabled={models.length === 0}
            onClick={() => {
              setStage("scan");
              selectColumn(activeId ?? models[0].id);
            }}
          >
            Scan the IMEIs →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-[18rem] flex-1 items-center gap-3 text-sm">
          <span className="shrink-0 text-[var(--muted)]">
            Scanning into{" "}
            <span className="font-mono text-[var(--ink)]">{active ? active.name : "— click a header —"}</span>
          </span>
          <input
            ref={scanRef}
            className="flex-1 px-3 py-2 font-mono"
            placeholder={active ? "Scan IMEI (or type it and press Enter)" : "Click a model header first"}
            value={scanValue}
            autoComplete="off"
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                handleScan(scanValue);
              }
            }}
          />
        </label>
        <span className="text-sm">
          Total <span className="font-mono">{totalScanned}</span>
        </span>
      </div>

      {message && (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            message.ok
              ? "border-[var(--ok)]/40 bg-[var(--ok)]/10"
              : "border-[var(--bad)]/40 bg-[var(--bad)]/10 text-[var(--bad)]"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="h-[min(30rem,60vh)] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--field)]">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--panel)]">
            <tr>
              <th className="w-12 border border-[var(--line)] px-2 py-2 text-xs font-normal text-[var(--muted)]">#</th>
              {models.map((m) => {
                const isActive = m.id === activeId;
                return (
                  <th
                    key={m.id}
                    className={`min-w-[13rem] border border-[var(--line)] p-0 ${
                      isActive ? "bg-[var(--accent)]/20 ring-2 ring-inset ring-[var(--accent)]" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left"
                        onClick={() => selectColumn(m.id)}
                        title="Click, then scan IMEIs into this model"
                      >
                        <span className="font-mono text-xs">{m.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                            isActive ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--chip)]"
                          }`}
                        >
                          {m.imeis.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="px-2 text-[var(--muted)] hover:text-[var(--bad)]"
                        onClick={() => removeModel(m)}
                        aria-label={`Remove ${m.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: height }, (_, row) => (
              <tr key={row}>
                <td className="border border-[var(--line-soft)] px-2 py-1 text-center font-mono text-xs text-[var(--muted)]">
                  {row + 1}
                </td>
                {models.map((m) => {
                  const imei = m.imeis[row];
                  const isNext = m.id === activeId && row === m.imeis.length;
                  const problem = imei ? badImeis.get(imei) : undefined;
                  return (
                    <td
                      key={m.id}
                      ref={isNext ? nextCellRef : undefined}
                      title={problem}
                      onClick={() => selectColumn(m.id)}
                      className={`group border border-[var(--line-soft)] px-3 py-1 font-mono text-xs ${
                        problem ? "bg-[var(--bad)]/25 text-[var(--bad)]" : ""
                      } ${isNext ? "bg-[var(--accent)]/10 outline outline-1 outline-[var(--accent)]/60" : ""}`}
                    >
                      {imei ? (
                        <span className="flex items-center justify-between gap-2">
                          {imei}
                          <button
                            type="button"
                            className="invisible text-[var(--muted)] group-hover:visible hover:text-[var(--bad)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImei(m.id, row);
                            }}
                            aria-label={`Remove ${imei}`}
                          >
                            ×
                          </button>
                        </span>
                      ) : isNext ? (
                        <span className="text-[var(--muted)]">scan…</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--muted)]">Add another model</summary>
        <div className="mt-2">{addModelRow}</div>
      </details>

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-quiet" onClick={startOver}>
          Clear all
        </button>
        <button
          type="button"
          className="btn-gold disabled:opacity-40"
          disabled={totalScanned === 0}
          onClick={() => {
            setPopupError("");
            setShowBoxes(true);
          }}
        >
          Next →
        </button>
      </div>

      {showBoxes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="surface max-h-[90vh] w-full max-w-3xl space-y-4 overflow-auto p-6">
            <div>
              <h3 className="text-lg font-semibold">Box packaging</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Enter how many units go in one box. Box numbers start at 1 for each model; a part-filled last box
                counts as a box.
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-normal">Model</th>
                  <th className="py-2 pr-3 font-normal">Scanned</th>
                  <th className="py-2 pr-3 font-normal">Units per box</th>
                  <th className="py-2 pr-3 font-normal">Boxes</th>
                  {international && <th className="py-2 font-normal">Country of origin</th>}
                </tr>
              </thead>
              <tbody>
                {models
                  .filter((m) => m.imeis.length > 0)
                  .map((m) => {
                    const boxes = boxesFor(m.imeis.length, m.perBox);
                    return (
                      <tr key={m.id} className="border-t border-[var(--line)]">
                        <td className="py-2 pr-3 font-mono text-xs">{m.name}</td>
                        <td className="py-2 pr-3 font-mono">{m.imeis.length}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={1}
                            className="w-24 px-2 py-1.5"
                            value={m.perBox}
                            onChange={(e) => updateModel(m.id, { perBox: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono">{boxes ?? "—"}</td>
                        {international && (
                          <td className="py-2">
                            <input
                              className="w-36 px-2 py-1.5"
                              placeholder="INDIA"
                              value={m.country}
                              onChange={(e) => updateModel(m.id, { country: e.target.value.toUpperCase() })}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                <tr className="border-t border-[var(--line-strong)] font-medium">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 font-mono">{totalScanned}</td>
                  <td />
                  <td className="py-2 pr-3 font-mono">
                    {models
                      .filter((m) => m.imeis.length > 0)
                      .reduce((sum, m) => sum + (boxesFor(m.imeis.length, m.perBox) ?? 0), 0)}
                  </td>
                  {international && <td />}
                </tr>
              </tbody>
            </table>
            {models.some((m) => m.imeis.length === 0) && (
              <p className="text-xs text-[var(--muted)]">Models with nothing scanned are left out.</p>
            )}
            {popupError && <p className="text-sm text-[var(--bad)]">{popupError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-quiet" disabled={busy} onClick={() => setShowBoxes(false)}>
                Back to scanning
              </button>
              <button
                type="button"
                className="btn-gold disabled:opacity-40"
                disabled={busy}
                onClick={() => void create()}
              >
                {busy ? "Working…" : "Create Excel & PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
