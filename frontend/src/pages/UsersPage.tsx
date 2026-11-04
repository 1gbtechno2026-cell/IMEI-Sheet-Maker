import { useEffect, useState, type FormEvent } from "react";

import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from "../api/auth";
import { ApiError } from "../api/client";
import type { AuthUser, Role } from "../lib/types";
import { useAuth } from "../auth/AuthContext";

const ROLES: Role[] = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];

type EditState = {
  id: number;
  name: string;
  role: Role;
};

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [resetFor, setResetFor] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function refresh() {
    const res = await listUsers();
    setUsers(res.users);
  }

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof ApiError ? err.detail : String(err));
    });
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createUser({ name, username, password, role });
      setMessage(`Created ${username} (${role})`);
      setName("");
      setUsername("");
      setPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateUser(edit.id, { name: edit.name, role: edit.role });
      setMessage(`Updated user #${edit.id}`);
      setEdit(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(u: AuthUser) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      setMessage(`${u.username} ${u.is_active ? "deactivated" : "activated"}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await resetUserPassword(resetFor.id, newPassword, true);
      setMessage(`Password reset for ${resetFor.username} (must change on next login)`);
      setResetFor(null);
      setNewPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-[var(--muted)]">
        ADMIN only. Create, edit role/name, deactivate, and reset passwords.
      </p>

      <form
        onSubmit={onCreate}
        className="mb-8 grid max-w-xl gap-3 rounded-xl border border-white/10 bg-[var(--panel)]/70 p-5"
      >
        <h2 className="text-sm font-medium">Create user</h2>
        <input
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          placeholder="Password (min 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <select
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Create user"}
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-[var(--bad)]">{error}</p>}
      {message && <p className="mb-3 text-sm text-[var(--ok)]">{message}</p>}

      {edit && (
        <form
          onSubmit={onSaveEdit}
          className="mb-6 grid max-w-xl gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel)]/80 p-5"
        >
          <h2 className="text-sm font-medium">Edit user #{edit.id}</h2>
          <input
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            required
          />
          <select
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={edit.role}
            onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEdit(null)}
              className="rounded-md border border-white/15 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {resetFor && (
        <form
          onSubmit={onResetPassword}
          className="mb-6 grid max-w-xl gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel)]/80 p-5"
        >
          <h2 className="text-sm font-medium">Reset password — {resetFor.username}</h2>
          <input
            type="password"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
            placeholder="New password (min 8)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          <p className="text-xs text-[var(--muted)]">User must change password on next login.</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setResetFor(null);
                setNewPassword("");
              }}
              className="rounded-md border border-white/15 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-black/30 text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono">{u.id}</td>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2 font-mono">{u.username}</td>
                <td className="px-3 py-2 font-mono">{u.role}</td>
                <td className="px-3 py-2">{u.is_active ? "yes" : "no"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setEdit({ id: u.id, name: u.name, role: u.role as Role })
                      }
                      className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setResetFor(u)}
                      className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
                    >
                      Reset pw
                    </button>
                    <button
                      type="button"
                      disabled={busy || u.id === me?.id}
                      onClick={() => void onToggleActive(u)}
                      className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
                      title={u.id === me?.id ? "Cannot deactivate yourself" : undefined}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
