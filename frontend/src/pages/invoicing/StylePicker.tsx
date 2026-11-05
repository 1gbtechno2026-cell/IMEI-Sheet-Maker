import { SHEET_STYLES, type SheetStyle } from "../../api/invoices";

type Props = {
  value: SheetStyle;
  onChange: (style: SheetStyle) => void;
};

/** Pick the look of the Excel and PDF. A small header-row preview shows the colour and font. */
export function StylePicker({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Sheet style" className="grid gap-2 sm:grid-cols-3">
      {SHEET_STYLES.map((style) => {
        const active = style.key === value;
        return (
          <button
            key={style.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(style.key)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/60" : "border-[var(--line)] hover:bg-[var(--hover)]"
            }`}
          >
            <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white text-[10px] text-black" style={{ fontFamily: style.font }}>
              <div className="flex" style={{ background: style.header, color: style.headerText }}>
                <span className="w-1/4 px-1.5 py-1 font-bold">Serial</span>
                <span className="w-1/2 px-1.5 py-1 font-bold">Model</span>
                <span className="w-1/4 px-1.5 py-1 font-bold">IMEI</span>
              </div>
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="flex"
                  style={{ background: row ? style.band : "#fff" }}
                >
                  <span className="w-1/4 px-1.5 py-0.5">{row + 1}</span>
                  <span className="w-1/2 px-1.5 py-0.5">GALAXY A36</span>
                  <span className="w-1/4 px-1.5 py-0.5">3580…</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm font-medium">{style.label}</p>
            <p className="text-xs text-[var(--muted)]">{style.note}</p>
          </button>
        );
      })}
    </div>
  );
}
