import { useEffect, useState, type FormEvent } from "react";

import type { Company, CompanyFormValues, GstDraft } from "../../api/companies";
import { fetchCompanyAssetObjectUrl } from "../../api/companies";

type Props = {
  open: boolean;
  initial?: Company | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: CompanyFormValues) => Promise<void>;
};

const emptyGst = (): GstDraft => ({ label: "", state: "", gstin: "" });

const empty: CompanyFormValues = {
  name: "",
  can_be_seller: true,
  can_be_buyer: true,
  gsts: [emptyGst()],
};

export function CompanyModal({ open, initial, busy, error, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<CompanyFormValues>(empty);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const gsts =
        initial.gsts && initial.gsts.length > 0
          ? initial.gsts.map((row) => ({ label: row.label, state: row.state, gstin: row.gstin }))
          : [emptyGst()];
      setValues({
        name: initial.name,
        can_be_seller: initial.can_be_seller,
        can_be_buyer: initial.can_be_buyer,
        gsts,
        signatureFile: null,
        stampFile: null,
        logoFile: null,
        clear_signature: false,
        clear_stamp: false,
        clear_logo: false,
      });
    } else {
      setValues(empty);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const revoked: string[] = [];
    let cancelled = false;

    async function loadExisting() {
      if (!initial) {
        setStampPreview(null);
        setLogoPreview(null);
        return;
      }
      if (initial.has_stamp || initial.has_signature) {
        const url = await fetchCompanyAssetObjectUrl(
          initial.id,
          initial.has_stamp ? "stamp" : "signature",
        );
        if (!cancelled && url) {
          revoked.push(url);
          setStampPreview(url);
        }
      } else {
        setStampPreview(null);
      }
      if (initial.has_logo) {
        const url = await fetchCompanyAssetObjectUrl(initial.id, "logo");
        if (!cancelled && url) {
          revoked.push(url);
          setLogoPreview(url);
        }
      } else {
        setLogoPreview(null);
      }
    }

    void loadExisting();
    return () => {
      cancelled = true;
      revoked.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [open, initial]);

  if (!open) return null;

  function setGst(index: number, patch: Partial<GstDraft>) {
    setValues((prev) => ({
      ...prev,
      gsts: prev.gsts.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function onLogo(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(url);
    setValues((prev) => ({ ...prev, logoFile: file, clear_logo: false }));
  }

  function onSignStamp(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (stampPreview?.startsWith("blob:")) URL.revokeObjectURL(stampPreview);
    setStampPreview(url);
    setValues((prev) => ({
      ...prev,
      stampFile: file,
      signatureFile: null,
      clear_stamp: false,
      clear_signature: true,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[var(--panel)] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold">{initial ? "Edit company" : "Add company"}</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-5">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Company name *</span>
            <input
              required
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2"
              value={values.name}
              onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <div className="text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[var(--muted)]">GST, one row per state *</span>
              <button
                type="button"
                className="text-xs text-[var(--accent)]"
                onClick={() => setValues((prev) => ({ ...prev, gsts: [...prev.gsts, emptyGst()] }))}
              >
                Add GST
              </button>
            </div>
            <div className="space-y-2">
              {values.gsts.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-white/10 p-3 md:grid-cols-[1fr_1fr_1.2fr_auto]">
                  <input
                    required
                    placeholder="Label"
                    className="rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={row.label}
                    onChange={(e) => setGst(index, { label: e.target.value })}
                  />
                  <input
                    required
                    placeholder="State"
                    className="rounded-md border border-white/10 bg-black/30 px-3 py-2"
                    value={row.state}
                    onChange={(e) => setGst(index, { state: e.target.value })}
                  />
                  <input
                    required
                    placeholder="GSTIN"
                    className="rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono"
                    value={row.gstin}
                    onChange={(e) => setGst(index, { gstin: e.target.value })}
                  />
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] hover:text-[var(--bad)]"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        gsts: prev.gsts.length === 1 ? prev.gsts : prev.gsts.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.can_be_seller}
                onChange={(e) => setValues((prev) => ({ ...prev, can_be_seller: e.target.checked }))}
              />
              Can be seller
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.can_be_buyer}
                onChange={(e) => setValues((prev) => ({ ...prev, can_be_buyer: e.target.checked }))}
              />
              Can be buyer
            </label>
          </div>

          <div className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Company logo (PNG/JPG) — printed in the sheet header
            </span>
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
            {logoPreview && (
              <div className="mt-2 inline-block rounded-md border border-white/10 bg-white p-2">
                <img src={logoPreview} alt="Logo preview" className="max-h-16 object-contain" />
              </div>
            )}
          </div>

          <div className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Sign and stamp (one image, PNG/JPG) — printed at the bottom right of every IMEI sheet
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => onSignStamp(e.target.files?.[0] || null)}
            />
            {stampPreview && (
              <div className="mt-2 inline-block rounded-md border border-white/10 bg-white p-2">
                <img src={stampPreview} alt="Sign and stamp preview" className="max-h-28 object-contain" />
              </div>
            )}
            {(initial?.has_stamp || initial?.has_signature) && (
              <button
                type="button"
                className="mt-1 block text-xs text-[var(--bad)]"
                onClick={() => {
                  setValues((prev) => ({
                    ...prev,
                    clear_stamp: true,
                    clear_signature: true,
                    stampFile: null,
                    signatureFile: null,
                  }));
                  setStampPreview(null);
                }}
              >
                Remove sign and stamp
              </button>
            )}
          </div>

          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : initial ? "Save changes" : "Add company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
