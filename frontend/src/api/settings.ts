import { apiFetch } from "./client";

export type Settings = {
  fy_start_month: number;
  default_currency: string;
  pdf_footer_terms: string;
  app_data_dir: string;
  db_path: string;
};

export type BackupInfo = {
  filename: string;
  path: string;
  size_bytes: number;
  modified_at: string;
};

export function fetchSettings() {
  return apiFetch<Settings>("/settings");
}

export function updateSettings(body: Partial<Pick<Settings, "fy_start_month" | "default_currency" | "pdf_footer_terms">>) {
  return apiFetch<Settings>("/settings", { method: "PUT", body: JSON.stringify(body) });
}

export function listBackups() {
  return apiFetch<{ backups: BackupInfo[] }>("/settings/backups");
}

export function createBackup() {
  return apiFetch<BackupInfo>("/settings/backups", { method: "POST" });
}

export function restoreBackup(filename: string) {
  return apiFetch<{ restored_from: string; db_path: string; message: string }>("/settings/backups/restore", {
    method: "POST",
    body: JSON.stringify({ filename }),
  });
}
