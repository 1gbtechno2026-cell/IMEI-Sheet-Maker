const TOKEN_KEY = "invoiceMaker.token";
const API_BASE_KEY = "invoiceMaker.apiBaseUrl";

let memoryApiBase = "";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function setApiBaseUrl(url: string): void {
  memoryApiBase = url;
  localStorage.setItem(API_BASE_KEY, url);
}

export function getApiBaseUrl(): string {
  if (memoryApiBase) return memoryApiBase;
  return localStorage.getItem(API_BASE_KEY) || "http://127.0.0.1:8000";
}

export async function resolveApiBaseUrl(): Promise<string> {
  if (window.invoiceMaker?.getApiBaseUrl) {
    const fromIpc = await window.invoiceMaker.getApiBaseUrl();
    if (fromIpc) {
      setApiBaseUrl(fromIpc);
      return fromIpc;
    }
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const url = envUrl || getApiBaseUrl();
  setApiBaseUrl(url);
  return url;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const base = getApiBaseUrl();
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!headers.has("Content-Type") && options.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  const authToken = token === undefined ? getStoredToken() : token;
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const res = await fetch(`${base}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { detail?: unknown };
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (data.detail != null) {
        detail = JSON.stringify(data.detail);
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
