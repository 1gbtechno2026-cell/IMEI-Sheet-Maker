export type Theme = "light" | "dark";

const STORAGE_KEY = "imeiDataMaker.theme";

/** The saved choice, or the system setting when nothing is saved yet. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // storage unavailable
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme, remember = true) {
  document.documentElement.dataset.theme = theme;
  if (!remember) return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // the theme still applies for this session
  }
}
