import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const { status, user, apiReady, apiError } = useAuth();

  if (status === "booting") {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Starting IMEI Sheet…
      </div>
    );
  }

  if (!apiReady) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
        <h1 className="mb-2 text-2xl font-semibold">Backend unavailable</h1>
        <p className="text-[var(--muted)]">{apiError || "Cannot reach the FastAPI sidecar."}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto px-5 py-7 md:px-10 md:py-9">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
