import { useEffect, useState } from "react";

import { listParties } from "../../api/invoices";
import type { Company } from "../../api/companies";

type Props = {
  role: "seller" | "buyer";
  value: number | null;
  excludeId?: number | null;
  onChange: (id: number | null, company: Company | null) => void;
  label: string;
};

export function PartySelect({ role, value, excludeId, onChange, label }: Props) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Company[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => {
      void listParties(role, q.trim() || undefined)
        .then((res) => {
          setOptions(res.companies.filter((c) => c.id !== excludeId));
          setError("");
        })
        .catch((err) => setError(String(err)));
    }, 200);
    return () => window.clearTimeout(id);
  }, [role, q, excludeId]);

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[var(--muted)]">{label}</span>
      <input
        className="mb-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
        placeholder={`Search ${role}…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          const company = options.find((c) => c.id === id) || null;
          onChange(id, company);
        }}
      >
        <option value="">Select {role}</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-[var(--bad)]">{error}</p>}
    </label>
  );
}
