import type { CompanyGst } from "../../api/companies";

type Props = {
  label: string;
  gsts: CompanyGst[];
  value: number | null;
  onChange: (id: number | null) => void;
};

export function GstSelect({ label, gsts, value, onChange }: Props) {
  if (gsts.length === 0) return null;
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--muted)]">{label}</span>
      <select
        className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Select GST</option>
        {gsts.map((gst) => (
          <option key={gst.id} value={gst.id}>
            {gst.label} — {gst.state} — {gst.gstin}
          </option>
        ))}
      </select>
    </label>
  );
}

export function defaultGstId(gsts: CompanyGst[] | undefined, current: number | null): number | null {
  const rows = gsts || [];
  if (current && rows.some((row) => row.id === current)) return current;
  if (rows.length === 1) return rows[0].id;
  return null;
}
