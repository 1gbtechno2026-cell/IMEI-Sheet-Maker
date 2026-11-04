import type { Permission, Role } from "./types";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ["dashboard", "onboarding", "invoicing", "history", "all_invoices", "settings", "users"],
  MANAGER: ["dashboard", "onboarding", "invoicing", "history", "all_invoices"],
  OPERATOR: ["dashboard", "invoicing", "history"],
  VIEWER: ["dashboard", "history"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
