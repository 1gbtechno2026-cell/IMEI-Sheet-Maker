import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../api/client";
import {
  activateCompany,
  createCompany,
  deactivateCompany,
  listCompanies,
  updateCompany,
  type Company,
  type CompanyFormValues,
} from "../api/companies";
import { CompanyModal } from "./onboarding/CompanyModal";

export function OnboardingPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async (query?: string) => {
    const res = await listCompanies(query, true);
    setCompanies(res.companies);
  }, []);

  useEffect(() => {
    void refresh(search).catch((err) => {
      setError(err instanceof ApiError ? err.detail : String(err));
    });
  }, [refresh, search]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  function openAdd() {
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setFormError("");
    setModalOpen(true);
  }

  async function onSubmit(values: CompanyFormValues) {
    setBusy(true);
    setFormError("");
    try {
      if (editing) {
        await updateCompany(editing.id, values);
      } else {
        await createCompany(values);
      }
      setModalOpen(false);
      await refresh(search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(company: Company) {
    setError("");
    try {
      if (company.is_active) {
        await deactivateCompany(company.id);
      } else {
        await activateCompany(company.id);
      }
      await refresh(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Each company has a name, a logo, one sign-and-stamp image, and a GST row for every state.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Add company
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="min-w-[16rem] flex-1 rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm"
          placeholder="Search name, label, state, GSTIN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-[var(--muted)]">{companies.length} companies</span>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--bad)]">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--field)] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">GST</th>
              <th className="px-3 py-2 font-medium">Roles</th>
              <th className="px-3 py-2 font-medium">Logo / sign</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">
                  No companies yet. Add one to get started.
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(c.gsts || []).length === 0
                      ? "—"
                      : (c.gsts || []).map((g) => `${g.label} · ${g.state}`).join(", ")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {[c.can_be_seller ? "Seller" : null, c.can_be_buyer ? "Buyer" : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">
                    {[c.has_logo ? "Logo" : null, c.has_stamp || c.has_signature ? "Sign" : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={c.is_active ? "text-[var(--ok)]" : "text-[var(--bad)]"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[var(--accent)] hover:underline"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[var(--muted)] hover:text-[var(--ink)] hover:underline"
                        onClick={() => void toggleActive(c)}
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CompanyModal
        open={modalOpen}
        initial={editing}
        busy={busy}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
      />
    </div>
  );
}
