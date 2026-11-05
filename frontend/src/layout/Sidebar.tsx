import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { hasPermission } from "../lib/permissions";
import type { Permission } from "../lib/types";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  to: string;
  label: string;
  permission?: Permission;
  action?: "logout";
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", permission: "dashboard" },
  { to: "/onboarding", label: "Onboarding", permission: "onboarding" },
  { to: "/invoicing", label: "IMEI sheet", permission: "invoicing" },
  { to: "/history", label: "History", permission: "history" },
  { to: "/all-invoices", label: "All Invoices", permission: "all_invoices" },
  { to: "/settings", label: "Settings", permission: "settings" },
  { to: "/users", label: "Users", permission: "users" },
  { to: "/login", label: "Logout", action: "logout" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--sidebar)]">
      <div className="border-b border-[var(--line)] px-5 py-6">
        <p className="text-[11px] tracking-[0.22em] text-[var(--accent)] uppercase">IMEI Data Maker</p>
        <p className="mt-2 truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-[var(--muted)]">
          {user.username} · {user.role}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          if (item.permission && !hasPermission(user.role, item.permission)) {
            return null;
          }
          if (item.action === "logout") {
            return (
              <button
                key="logout"
                type="button"
                onClick={() => void logout()}
                className="mt-auto rounded-full px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                Logout
              </button>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded-full px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-[var(--chip)] text-[var(--ink)] ring-1 ring-[var(--accent)]/60"
                    : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-[var(--line)] p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
