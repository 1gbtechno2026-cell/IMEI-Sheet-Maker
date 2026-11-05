import { useState } from "react";

import { applyTheme, currentTheme, type Theme } from "../lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const btn = (value: Theme, label: string) => (
    <button
      type="button"
      onClick={() => {
        applyTheme(value);
        setTheme(value);
      }}
      className={
        theme === value
          ? "flex-1 rounded-full bg-[var(--chip)] px-3 py-1 text-xs text-[var(--ink)] ring-1 ring-[var(--accent)]/60"
          : "flex-1 rounded-full px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
      }
    >
      {label}
    </button>
  );

  return (
    <div className="flex rounded-full border border-[var(--line)] p-1" role="group" aria-label="Theme">
      {btn("light", "Light")}
      {btn("dark", "Dark")}
    </div>
  );
}
