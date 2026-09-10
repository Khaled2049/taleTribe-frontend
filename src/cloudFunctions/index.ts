/**
 * Client for the Firebase Cloud Functions in `functions/` — the backend for work
 * the browser must not do itself: anything holding an API key, spending credits,
 * or writing a collection the rules deny to clients.
 *
 * Distinct from `@novelsync/story-data-client`, which serves product data. This
 * one has its own base URL, its own error type, no revisions and no cache layer,
 * which is why the two are not merged.
 *
 * `ai.ts`, `chat.ts` and `storage.ts` are typed wrappers over the client below;
 * this file is the only place that knows where Functions are deployed.
 */
import { auth } from "@novelsync/platform-auth";

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id";
const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1";

const isDevelopment = import.meta.env.MODE === "development";
// Use 127.0.0.1 (not "localhost") for the Functions emulator: on hosts where
// "localhost" resolves to IPv6 (::1) first, requests fail because the emulator
// binds IPv4 only. This matches the explicit 127.0.0.1 hosts in platform-auth's firebase.ts.
const baseURL = isDevelopment
  ? `http://127.0.0.1:5001/${projectId}/${region}`
  : `https://${region}-${projectId}.cloudfunctions.net`;

export class ApiError extends Error {
  response: { data: Record<string, unknown> };

  constructor(message: string, data: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.response = { data };
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${idToken}`;
    } catch (error) {
      console.error("Error getting ID token:", error);
    }
  }
  return headers;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  options?: { body?: unknown; params?: Record<string, string | number> },
): Promise<{ data: T }> {
  const headers = await getAuthHeaders();

  let url = `${baseURL}${path}`;
  if (options?.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      searchParams.set(key, String(value));
    }
    url += `?${searchParams.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let responseData: unknown;
  try {
    responseData = await res.json();
  } catch {
    responseData = {};
  }

  if (!res.ok) {
    throw new ApiError(
      res.statusText || `Request failed with status ${res.status}`,
      responseData as Record<string, unknown>,
    );
  }

  return { data: responseData as T };
}

const apiClient = {
  get<T>(path: string, options?: { params?: Record<string, string | number> }) {
    return request<T>("GET", path, options);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>("POST", path, { body });
  },
};

export default apiClient;

export function getFunctionUrl(functionName: string): string {
  const path = functionName.startsWith("/") ? functionName : `/${functionName}`;
  return `${baseURL}${path}`;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as {
      response?: {
        data?: {
          error?: string | { message?: string };
          details?: string;
          detail?: string | { message?: string };
        };
      };
      message?: string;
    };
    const responseData = e.response?.data;
    const shapedError = responseData?.error;
    const detail = responseData?.detail;
    return (
      (typeof shapedError === "string" ? shapedError : shapedError?.message) ||
      responseData?.details ||
      (typeof detail === "string" ? detail : detail?.message) ||
      e.message ||
      fallback
    );
  }
  return fallback;
}
