import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as authApi from "../api/auth";
import { getStoredToken, resolveApiBaseUrl, setStoredToken } from "../api/client";
import type { AuthUser } from "../lib/types";

type AuthStatus = "booting" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  apiReady: boolean;
  apiError: string | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await resolveApiBaseUrl();
        if (cancelled) return;
        setApiReady(true);
        setApiError(null);

        // Trigger first-run admin creation via bootstrap/login path health.
        await authApi.fetchBootstrapStatus();

        const existing = getStoredToken();
        if (existing) {
          try {
            const me = await authApi.fetchMe();
            if (!cancelled) {
              setUser(me);
              setToken(existing);
            }
          } catch {
            setStoredToken(null);
            if (!cancelled) {
              setUser(null);
              setToken(null);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setApiReady(false);
          setApiError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setStatus("ready");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    setStoredToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await authApi.changePassword(currentPassword, newPassword);
    setStoredToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await authApi.logoutRequest();
      }
    } catch {
      // ignore network errors on logout
    } finally {
      setStoredToken(null);
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await authApi.fetchMe();
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      token,
      apiReady,
      apiError,
      login,
      changePassword,
      logout,
      refreshMe,
    }),
    [status, user, token, apiReady, apiError, login, changePassword, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
