import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  createBackup,
  fetchSettings,
  listBackups,
  restoreBackup,
  updateSettings,
  type BackupInfo,
  type Settings,
} from "../api/settings";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [fyStart, setFyStart] = useState(4);
  const [currency, setCurrency] = useState("INR");
  const [footer, setFooter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [s, b] = await Promise.all([fetchSettings(), listBackups()]);
    setSettings(s);
    setFyStart(s.fy_start_month);
    setCurrency(s.default_currency);
    setFooter(s.pdf_footer_terms);
    setBackups(b.backups);
  }

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof ApiError ? err.detail : String(err));
    });
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const s = await updateSettings({
        fy_start_month: fyStart,
        default_currency: currency.trim().toUpperCase(),
        pdf_footer_terms: footer,
      });
      setSettings(s);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onBackup() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const info = await createBackup();
      setMessage(`Backup created: ${info.filename}`);
      const b = await listBackups();
      setBackups(b.backups);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(filename: string) {
    if (
      !window.confirm(
        `Restore ${filename}? A pre-restore snapshot is taken first. Restart the app after restore.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await restoreBackup(filename);
      setMessage(res.message);
      const b = await listBackups();
      setBackups(b.backups);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          FY, currency, PDF footer, data paths, and database backups (ADMIN).
        </p>
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      {message && <p className="text-sm text-[var(--ok)]">{message}</p>}

      <form
        onSubmit={onSave}
        className="grid max-w-xl gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5"
      >
        <h2 className="text-sm font-medium">Company settings</h2>

        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Financial year start month</span>
          <select
            className="rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2"
            value={fyStart}
            onChange={(e) => setFyStart(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">Default currency</span>
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 uppercase"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={10}
            required
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted)]">PDF footer / terms</span>
          <textarea
            className="min-h-[100px] rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Optional terms printed at the bottom of invoices"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>

      <section className="max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5">
        <h2 className="mb-3 text-sm font-medium">Data folder</h2>
        {settings ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--muted)]">App data</dt>
              <dd className="break-all font-mono text-xs">{settings.app_data_dir}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Database</dt>
              <dd className="break-all font-mono text-xs">{settings.db_path}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
      </section>

      <section className="max-w-2xl space-y-4 rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Backups</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Auto-backup on API start. Manual backup/restore of app.db. Keeps last 10 in /backups.
              After restore, restart IMEI Data Maker so the API reloads the database. Installer/app
              upgrades never wipe this folder (Windows %APPDATA% or macOS Application Support).
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onBackup()}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Backup now
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-medium">File</th>
                <th className="py-2 pr-3 font-medium">Size</th>
                <th className="py-2 pr-3 font-medium">Modified (UTC)</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filename} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3 font-mono text-xs">{b.filename}</td>
                  <td className="py-2 pr-3">{formatBytes(b.size_bytes)}</td>
                  <td className="py-2 pr-3 text-xs">{b.modified_at}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRestore(b.filename)}
                      className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs hover:bg-[var(--hover)] disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-[var(--muted)]">
                    No backups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
