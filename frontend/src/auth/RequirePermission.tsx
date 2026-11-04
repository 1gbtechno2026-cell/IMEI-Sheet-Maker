import { Navigate } from "react-router-dom";

import { hasPermission } from "../lib/permissions";
import type { Permission } from "../lib/types";
import { useAuth } from "./AuthContext";

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!hasPermission(user.role, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
