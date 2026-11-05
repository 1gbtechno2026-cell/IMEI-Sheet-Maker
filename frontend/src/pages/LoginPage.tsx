import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { user, login, apiReady, apiError, status } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "booting") {
    return <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">Loading…</div>;
  }

  if (user && user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="mb-2 text-sm tracking-[0.22em] text-[var(--accent)] uppercase">IMEI Data Maker</p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        First run creates admin / admin and requires a password change.
      </p>

      {!apiReady && (
        <p className="mb-4 rounded-md border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-sm">
          {apiError || "Backend not connected"}
        </p>
      )}

      <form onSubmit={onSubmit} className="surface space-y-4 p-6">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Username</span>
          <input
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Password</span>
          <input
            type="password"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--field)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !apiReady}
          className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
