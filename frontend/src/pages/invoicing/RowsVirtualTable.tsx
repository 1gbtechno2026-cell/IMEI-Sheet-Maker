import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { InvoiceRow, InvoiceType } from "../../api/invoices";

type Props = {
  rows: InvoiceRow[];
  invoiceType: InvoiceType;
  onChangeRow: (index: number, patch: Partial<InvoiceRow>) => void;
  onRemoveRow: (index: number) => void;
};

export function RowsVirtualTable({ rows, invoiceType, onChangeRow, onRemoveRow }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const international = invoiceType === "INTERNATIONAL";
  const grid = international
    ? "grid-cols-[3rem_1fr_6rem_1fr_4.5rem_7rem_minmax(9rem,1.1fr)_4rem]"
    : "grid-cols-[3rem_1.2fr_6rem_1fr_4.5rem_minmax(9rem,1.1fr)_4rem]";
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div className={`grid ${grid} gap-2 bg-[var(--field)] px-3 py-2 text-xs text-[var(--muted)]`}>
        <span>Serial</span>
        <span>Model No</span>
        <span>Colour</span>
        <span>IMEI</span>
        <span>Box No</span>
        {international && <span>Country</span>}
        <span>Status</span>
        <span />
      </div>
      <div ref={parentRef} className="h-[min(28rem,50vh)] overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index];
            const serial = rows
              .slice(0, vRow.index + 1)
              .filter((item) => item.model_no === row.model_no && (item.color || "") === (row.color || "")).length;
            const bad = (row.errors?.length || 0) > 0;
            const fieldErr = new Set(row.error_fields || []);
            return (
              <div
                key={vRow.key}
                className={`absolute left-0 grid w-full ${grid} gap-2 border-t border-[var(--line-soft)] px-3 py-1 text-sm ${
                  bad ? "bg-[var(--bad)]/10" : ""
                }`}
                style={{ height: vRow.size, transform: `translateY(${vRow.start}px)` }}
                title={row.errors?.join("; ")}
              >
                <span className="self-center font-mono text-xs text-[var(--muted)]">
                  {serial}
                </span>
                <input
                  className={`rounded border bg-[var(--field)] px-2 py-1 ${
                    fieldErr.has("model_no") ? "border-[var(--bad)]" : "border-[var(--line)]"
                  }`}
                  value={row.model_no}
                  onChange={(e) => onChangeRow(vRow.index, { model_no: e.target.value })}
                />
                <input
                  className="rounded border border-[var(--line)] bg-[var(--field)] px-2 py-1"
                  value={row.color || ""}
                  onChange={(e) => onChangeRow(vRow.index, { color: e.target.value })}
                />
                <input
                  className={`rounded border bg-[var(--field)] px-2 py-1 font-mono text-xs ${
                    fieldErr.has("imei") ? "border-[var(--bad)]" : "border-[var(--line)]"
                  }`}
                  value={row.imei}
                  onChange={(e) => onChangeRow(vRow.index, { imei: e.target.value })}
                />
                <input
                  className={`rounded border bg-[var(--field)] px-2 py-1 ${
                    fieldErr.has("box_no") ? "border-[var(--bad)]" : "border-[var(--line)]"
                  }`}
                  value={row.box_no || ""}
                  onChange={(e) => onChangeRow(vRow.index, { box_no: e.target.value })}
                />
                {international && (
                  <input
                    className={`rounded border bg-[var(--field)] px-2 py-1 ${
                      fieldErr.has("country_of_origin") ? "border-[var(--bad)]" : "border-[var(--line)]"
                    }`}
                    value={row.country_of_origin || ""}
                    onChange={(e) => onChangeRow(vRow.index, { country_of_origin: e.target.value })}
                  />
                )}
                <span
                  className={`self-center text-xs leading-tight ${bad ? "text-[var(--bad)]" : "text-[var(--ok)]"}`}
                >
                  {bad ? row.errors?.[0] || "Error" : "OK"}
                </span>
                <button
                  type="button"
                  className="self-center text-xs text-[var(--muted)] hover:text-[var(--bad)]"
                  onClick={() => onRemoveRow(vRow.index)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
