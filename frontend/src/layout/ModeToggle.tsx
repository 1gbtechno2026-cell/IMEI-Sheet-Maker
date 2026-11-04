import { useInvoiceMode } from "../auth/ModeContext";
import type { InvoiceMode } from "../lib/types";

export function ModeToggle() {
  const { mode, setMode } = useInvoiceMode();

  const btn = (value: InvoiceMode, label: string) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => setMode(value)}
        className={
          active
            ? "rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--accent-ink)]"
            : "rounded-full px-3.5 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1">
      {btn("LOCAL", "Local")}
      {btn("INTERNATIONAL", "International")}
    </div>
  );
}
