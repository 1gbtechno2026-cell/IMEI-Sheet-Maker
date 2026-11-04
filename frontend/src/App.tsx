import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { ModeProvider } from "./auth/ModeContext";
import { RequirePermission } from "./auth/RequirePermission";
import { AppShell } from "./layout/AppShell";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EditInvoicePage } from "./pages/EditInvoicePage";
import { InvoiceListPage } from "./pages/InvoiceListPage";
import { InvoicingPage } from "./pages/InvoicingPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <RequirePermission permission="dashboard">
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequirePermission permission="onboarding">
              <OnboardingPage />
            </RequirePermission>
          }
        />

        <Route
          path="/invoicing"
          element={
            <RequirePermission permission="invoicing">
              <InvoicingPage />
            </RequirePermission>
          }
        />

        <Route
          path="/history"
          element={
            <RequirePermission permission="history">
              <InvoiceListPage scope="history" />
            </RequirePermission>
          }
        />
        <Route
          path="/all-invoices"
          element={
            <RequirePermission permission="all_invoices">
              <InvoiceListPage scope="all" />
            </RequirePermission>
          }
        />
        <Route
          path="/invoices/:id/edit"
          element={
            <RequirePermission permission="invoicing">
              <EditInvoicePage />
            </RequirePermission>
          }
        />

        <Route
          path="/settings"
          element={
            <RequirePermission permission="settings">
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/users"
          element={
            <RequirePermission permission="users">
              <UsersPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  // HashRouter works in packaged Electron file://; BrowserRouter for Vite/dev web.
  const Router = window.invoiceMaker ? HashRouter : BrowserRouter;

  return (
    <AuthProvider>
      <ModeProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ModeProvider>
    </AuthProvider>
  );
}
