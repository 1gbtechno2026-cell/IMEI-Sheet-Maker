import { useEffect, useState } from "react";

import { checkAccess } from "../api/auth";
import { ApiError } from "../api/client";
import { useInvoiceMode } from "../auth/ModeContext";
import { ModeToggle } from "../layout/ModeToggle";

type Props = {
  title: string;
  description: string;
  accessPath?: string;
  showModeToggle?: boolean;
};

export function PlaceholderPage({ title, description, accessPath, showModeToggle }: Props) {
  const { mode } = useInvoiceMode();
  const [accessNote, setAccessNote] = useState<string>("");

  useEffect(() => {
    if (!accessPath) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await checkAccess(accessPath);
        if (!cancelled) {
          setAccessNote(`API access ok · role ${res.role}`);
        }
      } catch (err) {
        if (!cancelled) {
          setAccessNote(err instanceof ApiError ? `API denied: ${err.detail}` : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessPath]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
        </div>
        {showModeToggle && <ModeToggle />}
      </div>

      <section className="rounded-xl border border-white/10 bg-[var(--panel)]/70 p-5">
        <p className="text-sm text-[var(--muted)]">Placeholder — implemented in a later phase.</p>
        {showModeToggle && (
          <p className="mt-3 font-mono text-sm">
            Active mode: <span className="text-[var(--ink)]">{mode}</span>
          </p>
        )}
        {accessNote && <p className="mt-3 font-mono text-xs text-[var(--muted)]">{accessNote}</p>}
      </section>
    </div>
  );
}
