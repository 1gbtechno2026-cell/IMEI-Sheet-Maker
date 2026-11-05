import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.must_change_password) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-semibold">Change password</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Signed in as <span className="font-mono text-[var(--ink)]">{user.username}</span>. You must set a
        new password before continuing.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--panel)]/90 p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Current password</span>
          <input
            type="password"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">New password (min 8)</span>
          <input
            type="password"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Confirm new password</span>
          <input
            type="password"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
