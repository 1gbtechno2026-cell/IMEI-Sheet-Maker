import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../api/client";
import { fetchDashboard, type DashboardData } from "../api/dashboard";
import { useAuth } from "../auth/AuthContext";

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/80 p-4">
      <p className="text-xs tracking-[0.14em] text-[var(--muted)] uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.detail : String(err)));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Welcome, {user?.name}.</p>
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Invoices today" value={data.invoices_today} />
            <Card label="Invoices this month" value={data.invoices_month} />
            <Card label="Units billed (month)" value={data.units_month} />
            <Card label="Units billed (all)" value={data.units_total} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5">
              <h2 className="mb-3 text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
                Local vs International
              </h2>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-[var(--muted)]">Local</p>
                  <p className="text-2xl font-semibold tabular-nums">{data.split.LOCAL}</p>
                </div>
                <div>
                  <p className="text-[var(--muted)]">International</p>
                  <p className="text-2xl font-semibold tabular-nums">{data.split.INTERNATIONAL}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5">
              <h2 className="mb-3 text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
                Top buyers
              </h2>
              {data.top_buyers.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.top_buyers.map((b) => (
                    <li key={b.buyer_id} className="flex justify-between gap-3">
                      <span>{b.buyer_name}</span>
                      <span className="font-mono text-[var(--muted)]">{b.invoice_count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">
                Recent invoices
              </h2>
              <Link to="/history" className="text-xs text-[var(--accent)] hover:underline">
                View history
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Invoice</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Buyer</th>
                    <th className="py-2 pr-3 font-medium">Units</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-[var(--line)]">
                      <td className="py-2 pr-3 font-mono text-xs">{inv.invoice_no}</td>
                      <td className="py-2 pr-3">{inv.invoice_type}</td>
                      <td className="py-2 pr-3">{inv.invoice_date}</td>
                      <td className="py-2 pr-3">{inv.buyer_name || "—"}</td>
                      <td className="py-2 pr-3 font-mono">{inv.item_count}</td>
                      <td className="py-2">{inv.status}</td>
                    </tr>
                  ))}
                  {data.recent_invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-[var(--muted)]">
                        No invoices yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
