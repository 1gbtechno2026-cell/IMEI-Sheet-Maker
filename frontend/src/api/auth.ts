import type { AuthUser, Role, TokenResponse } from "../lib/types";
import { apiFetch } from "./client";

export type BootstrapStatus = {
  needs_bootstrap: boolean;
  user_count: number;
};

export function fetchBootstrapStatus() {
  return apiFetch<BootstrapStatus>("/auth/bootstrap-status", {}, null);
}

export function login(username: string, password: string) {
  return apiFetch<TokenResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    null,
  );
}

export function fetchMe() {
  return apiFetch<AuthUser>("/auth/me");
}

export function changePassword(current_password: string, new_password: string) {
  return apiFetch<TokenResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}

export function logoutRequest() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export function listUsers() {
  return apiFetch<{ users: AuthUser[] }>("/users");
}

export function createUser(body: {
  name: string;
  username: string;
  password: string;
  role: Role;
}) {
  return apiFetch<AuthUser>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateUser(
  id: number,
  body: { name?: string; role?: Role; is_active?: boolean },
) {
  return apiFetch<AuthUser>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function resetUserPassword(
  id: number,
  new_password: string,
  must_change_password = true,
) {
  return apiFetch<AuthUser>(`/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ new_password, must_change_password }),
  });
}

export function checkAccess(featurePath: string) {
  return apiFetch<{ feature: string; ok: boolean; role: string }>(`/access/${featurePath}`);
}
