/** Server-to-server transport for creditProxy's admin routes. */
import { GoogleAuth } from "google-auth-library";
import { defineString } from "firebase-functions/params";

const creditProxyUrlParam = defineString("CREDIT_PROXY_URL", {
  default: "http://localhost:8090",
  description: "URL of the creditProxy gateway",
});

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const auth = isEmulator ? null : new GoogleAuth();
const isLocal = (url: string) => /localhost|127\.0\.0\.1/.test(url);

export class CreditProxyError extends Error {
  constructor(public readonly status: number) {
    super(`creditProxy returned HTTP ${status}`);
    this.name = "CreditProxyError";
  }
}

function baseUrl(): string {
  const url = creditProxyUrlParam.value().replace(/\/$/, "");
  if (!url) throw new Error("CREDIT_PROXY_URL must be configured");
  if (!isEmulator && isLocal(url)) {
    throw new Error("CREDIT_PROXY_URL cannot point to localhost in production");
  }
  return url;
}

let idTokenClient: ReturnType<GoogleAuth["getIdTokenClient"]> | null = null;

async function identityToken(audience: string): Promise<string | null> {
  if (!auth || isLocal(audience)) return null;
  if (!idTokenClient) {
    idTokenClient = auth.getIdTokenClient(audience);
    idTokenClient.catch(() => (idTokenClient = null));
  }
  const headers = await (await idTokenClient).getRequestHeaders();
  return headers.get("Authorization")?.split(" ")[1] ?? null;
}

/**
 * GET an admin route. The gateway checks the caller's Google identity and,
 * separately, the admin claim on the forwarded Firebase token, so the admin's
 * own token travels with the request rather than being vouched for here.
 */
export async function getCreditProxyAdmin<T>(
  path: string,
  firebaseToken: string,
  timeoutMs = 15_000,
): Promise<T> {
  const url = baseUrl();
  const token = await identityToken(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Firebase-Token": firebaseToken,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new CreditProxyError(response.status);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
