import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { InvoiceMode } from "../lib/types";

type ModeContextValue = {
  mode: InvoiceMode;
  setMode: (mode: InvoiceMode) => void;
};

const ModeContext = createContext<ModeContextValue | null>(null);

const MODE_KEY = "invoiceMaker.invoiceMode";

function readInitialMode(): InvoiceMode {
  const stored = localStorage.getItem(MODE_KEY);
  return stored === "INTERNATIONAL" ? "INTERNATIONAL" : "LOCAL";
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<InvoiceMode>(readInitialMode);

  const setMode = (next: InvoiceMode) => {
    localStorage.setItem(MODE_KEY, next);
    setModeState(next);
  };

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useInvoiceMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error("useInvoiceMode must be used within ModeProvider");
  }
  return ctx;
}
