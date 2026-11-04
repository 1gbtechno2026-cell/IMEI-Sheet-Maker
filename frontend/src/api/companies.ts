import { apiFetch, getApiBaseUrl, getStoredToken } from "./client";

export type CompanyGst = {
  id: number;
  label: string;
  state: string;
  gstin: string;
  sort_order?: number;
};

export type Company = {
  id: number;
  name: string;
  address?: string | null;
  gstin: string | null;
  pan?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  can_be_seller: boolean;
  can_be_buyer: boolean;
  signature_path: string | null;
  stamp_path: string | null;
  logo_path?: string | null;
  has_signature: boolean;
  has_stamp: boolean;
  has_logo?: boolean;
  invoice_prefix?: string | null;
  is_active: boolean;
  gsts?: CompanyGst[];
  created_at: string;
  updated_at: string;
};

export type GstDraft = {
  label: string;
  state: string;
  gstin: string;
};

export type CompanyFormValues = {
  name: string;
  can_be_seller: boolean;
  can_be_buyer: boolean;
  gsts: GstDraft[];
  signatureFile?: File | null;
  stampFile?: File | null;
  logoFile?: File | null;
  clear_signature?: boolean;
  clear_stamp?: boolean;
  clear_logo?: boolean;
};

function toFormData(values: CompanyFormValues): FormData {
  const fd = new FormData();
  fd.set("name", values.name);
  fd.set("can_be_seller", String(values.can_be_seller));
  fd.set("can_be_buyer", String(values.can_be_buyer));
  fd.set(
    "gst_rows",
    JSON.stringify(
      values.gsts.map((row) => ({
        label: row.label,
        state: row.state,
        gstin: row.gstin,
      })),
    ),
  );
  if (values.clear_signature) fd.set("clear_signature", "true");
  if (values.clear_stamp) fd.set("clear_stamp", "true");
  if (values.clear_logo) fd.set("clear_logo", "true");
  if (values.signatureFile) fd.set("signature", values.signatureFile);
  if (values.stampFile) fd.set("stamp", values.stampFile);
  if (values.logoFile) fd.set("logo", values.logoFile);
  return fd;
}

export function listCompanies(q?: string, includeInactive = true) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("include_inactive", String(includeInactive));
  const qs = params.toString();
  return apiFetch<{ companies: Company[]; total: number }>(`/companies?${qs}`);
}

export function createCompany(values: CompanyFormValues) {
  return apiFetch<Company>("/companies", {
    method: "POST",
    body: toFormData(values),
  });
}

export function updateCompany(id: number, values: CompanyFormValues) {
  return apiFetch<Company>(`/companies/${id}`, {
    method: "PUT",
    body: toFormData(values),
  });
}

export function deactivateCompany(id: number) {
  return apiFetch<Company>(`/companies/${id}/deactivate`, { method: "POST" });
}

export function activateCompany(id: number) {
  return apiFetch<Company>(`/companies/${id}/activate`, { method: "POST" });
}

/** Authenticated blob URL for signature/stamp preview in the UI. */
export async function fetchCompanyAssetObjectUrl(
  companyId: number,
  kind: "signature" | "stamp" | "logo",
): Promise<string | null> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBaseUrl()}/companies/${companyId}/assets/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
