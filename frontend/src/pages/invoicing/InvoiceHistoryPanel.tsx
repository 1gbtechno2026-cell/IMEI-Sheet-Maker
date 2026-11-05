import { useEffect, useState } from "react";

import { getInvoiceHistory, type HistoryEntry } from "../../api/invoices";
import { ApiError } from "../../api/client";

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Edited",
  files: "PDF & Excel",
  soft_delete: "Deleted",
};

function formatWhen(at: string | null) {
  if (!at) return "";
  // SQLite stores UTC without a zone; treat a bare timestamp as UTC.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(at) ? at : `${at}Z`);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
}

/** Who created, edited and regenerated this invoice, newest first. */
export function InvoiceHistoryPanel({ invoiceId, refreshKey }: { invoiceId: number; refreshKey?: unknown }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getInvoiceHistory(invoiceId)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, refreshKey]);

  return (
    <section className="space-y-3 surface p-5">
      <h2 className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">Edit history</h2>
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      {entries === null && !error && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {entries?.length === 0 && <p className="text-sm text-[var(--muted)]">No changes recorded yet.</p>}
      <ol className="space-y-2">
        {entries?.map((entry) => (
          <li key={entry.id} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{ACTION_LABELS[entry.action] || entry.action}</span>
              <span className="text-xs text-[var(--muted)]">
                {entry.user} · {formatWhen(entry.at)}
              </span>
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
              {entry.changes.map((line, i) => (
                <li key={i} className="font-mono">
                  {line}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
