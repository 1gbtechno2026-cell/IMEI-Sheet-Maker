import { apiFetch } from "./client";

export type DashboardData = {
  as_of: string;
  invoices_today: number;
  invoices_month: number;
  units_total: number;
  units_month: number;
  split: { LOCAL: number; INTERNATIONAL: number };
  top_buyers: { buyer_id: number; buyer_name: string; invoice_count: number }[];
  recent_invoices: {
    id: number;
    invoice_no: string;
    invoice_type: string;
    invoice_date: string;
    status: string;
    seller_name: string | null;
    buyer_name: string | null;
    item_count: number;
  }[];
};

export function fetchDashboard() {
  return apiFetch<DashboardData>("/dashboard");
}
