import type { Company } from "./companies";
import { apiFetch, getApiBaseUrl, getStoredToken } from "./client";

export type InvoiceType = "LOCAL" | "INTERNATIONAL";

export type PartyList = { companies: Company[]; total: number };

export type NumberPreview = {
  invoice_no: string;
  financial_year: string;
  next_number: number;
  fy_start_month: number;
  reserved: boolean;
  prefix: string;
  type_code: string;
};

export type InvoiceRow = {
  row_index?: number;
  model_no: string;
  imei: string;
  box_no?: string | null;
  country_of_origin?: string | null;
  errors?: string[];
  error_fields?: string[];
  ok?: boolean;
};

export type ParseUploadResult = {
  headers: string[];
  detected_map: {
    model_no: string | null;
    imei: string | null;
    box_no: string | null;
    country_of_origin?: string | null;
  };
  effective_map?: { model_no: string | null; imei: string | null; box_no: string | null };
  needs_manual_map: boolean;
  rows: InvoiceRow[];
  row_count: number;
  source_file_name?: string;
};

export type ValidateResult = {
  rows: InvoiceRow[];
  total: number;
  valid_count: number;
  error_count: number;
  summary: { model_no: string; quantity: number }[];
  can_save: boolean;
};

export type DraftInvoice = {
  id: number;
  invoice_no: string;
  invoice_type: string;
  seller_id: number;
  buyer_id: number;
  seller_name?: string | null;
  buyer_name?: string | null;
  seller_gst_id?: number | null;
  buyer_gst_id?: number | null;
  seller_gsts?: { id: number; label: string; state: string; gstin: string }[];
  buyer_gsts?: { id: number; label: string; state: string; gstin: string }[];
  invoice_date: string;
  country_of_origin: string | null;
  currency: string | null;
  status: string;
  pdf_path: string | null;
  is_deleted?: boolean;
  created_by?: number | null;
  item_count: number;
  summary: { model_no: string; quantity: number }[];
  source_file_name: string | null;
  notes?: string | null;
  items?: {
    id?: number;
    model_no: string;
    imei: string;
    box_no?: string | null;
    country_of_origin?: string | null;
    rate?: string | null;
  }[];
};

export type InvoiceRecord = DraftInvoice;

export type InvoiceListFilters = {
  mine?: boolean;
  status?: string;
  invoice_type?: string;
  seller_id?: number;
  buyer_id?: number;
  date_from?: string;
  date_to?: string;
  invoice_no?: string;
  imei?: string;
  include_deleted?: boolean;
};

export function listParties(role: "seller" | "buyer", q?: string) {
  const params = new URLSearchParams({ role });
  if (q) params.set("q", q);
  return apiFetch<PartyList>(`/invoices/parties?${params}`);
}

export function previewNumber(sellerId: number, invoiceType: InvoiceType, invoiceDate: string) {
  const params = new URLSearchParams({
    seller_id: String(sellerId),
    invoice_type: invoiceType,
    invoice_date: invoiceDate,
  });
  return apiFetch<NumberPreview>(`/invoices/preview-number?${params}`);
}

export function getInvoiceMeta() {
  return apiFetch<{ default_currency: string }>("/invoices/meta");
}

export async function downloadUploadTemplate(invoiceType: InvoiceType = "LOCAL"): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBaseUrl()}/invoices/upload-template?invoice_type=${invoiceType}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Template download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    invoiceType === "INTERNATIONAL"
      ? "imei-sheet-template-international.xlsx"
      : "imei-sheet-template-local.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseUpload(
  file: File,
  invoiceType: InvoiceType,
  columnMap?: { model_no?: string; imei?: string; box_no?: string; country_of_origin?: string },
) {
  const fd = new FormData();
  fd.set("invoice_type", invoiceType);
  fd.set("file", file);
  if (columnMap) fd.set("column_map", JSON.stringify(columnMap));
  return apiFetch<ParseUploadResult>("/invoices/parse-upload", { method: "POST", body: fd });
}

export function validateRows(
  invoiceType: InvoiceType,
  rows: InvoiceRow[],
  excludeInvoiceId?: number,
) {
  return apiFetch<ValidateResult>("/invoices/validate-rows", {
    method: "POST",
    body: JSON.stringify({
      invoice_type: invoiceType,
      rows,
      exclude_invoice_id: excludeInvoiceId ?? null,
    }),
  });
}

export function saveDraft(payload: {
  invoice_no: string;
  invoice_type: InvoiceType;
  seller_id: number;
  buyer_id: number;
  seller_gst_id?: number | null;
  buyer_gst_id?: number | null;
  invoice_date: string;
  source_file_name?: string | null;
  rows: InvoiceRow[];
}) {
  return apiFetch<DraftInvoice>("/invoices/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getInvoice(id: number) {
  return apiFetch<InvoiceRecord>(`/invoices/${id}`);
}

export function listInvoices(params?: InvoiceListFilters) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.mine) qs.set("mine", "true");
  if (params?.invoice_type) qs.set("invoice_type", params.invoice_type);
  if (params?.seller_id != null) qs.set("seller_id", String(params.seller_id));
  if (params?.buyer_id != null) qs.set("buyer_id", String(params.buyer_id));
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.invoice_no) qs.set("invoice_no", params.invoice_no);
  if (params?.imei) qs.set("imei", params.imei);
  if (params?.include_deleted) qs.set("include_deleted", "true");
  const q = qs.toString();
  return apiFetch<{ invoices: InvoiceRecord[]; total: number }>(`/invoices${q ? `?${q}` : ""}`);
}

export function updateInvoice(
  id: number,
  payload: {
    invoice_no: string;
    buyer_id: number;
    seller_gst_id?: number | null;
    buyer_gst_id?: number | null;
    invoice_date: string;
    source_file_name?: string | null;
    rows: InvoiceRow[];
    regenerate_pdf?: boolean;
  },
) {
  return apiFetch<InvoiceRecord>(`/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteInvoice(id: number) {
  return apiFetch<InvoiceRecord>(`/invoices/${id}`, { method: "DELETE" });
}

export function validateRowsForEdit(
  invoiceType: InvoiceType,
  rows: InvoiceRow[],
  excludeInvoiceId?: number,
) {
  return apiFetch<ValidateResult>("/invoices/validate-rows", {
    method: "POST",
    body: JSON.stringify({
      invoice_type: invoiceType,
      rows,
      exclude_invoice_id: excludeInvoiceId ?? null,
    }),
  });
}

export function finalizeInvoice(id: number) {
  return apiFetch<InvoiceRecord>(`/invoices/${id}/finalize`, { method: "POST" });
}

export function regeneratePdf(id: number) {
  return apiFetch<InvoiceRecord>(`/invoices/${id}/regenerate-pdf`, { method: "POST" });
}

/** Fetch PDF as blob URL for iframe preview / download. */
export async function fetchInvoicePdfObjectUrl(id: number): Promise<string> {
  const token = getStoredToken();
  const res = await fetch(`${getApiBaseUrl()}/invoices/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`PDF download failed (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

