export type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export type InvoiceMode = "LOCAL" | "INTERNATIONAL";

export type Permission =
  | "dashboard"
  | "onboarding"
  | "invoicing"
  | "history"
  | "all_invoices"
  | "settings"
  | "users";

export type AuthUser = {
  id: number;
  name: string;
  username: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  permissions: Permission[];
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};
