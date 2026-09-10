/** Server-to-server transport for the TaleTribe recommendation service. */
import { GoogleAuth } from "google-auth-library";
import { defineString } from "firebase-functions/params";

const recommendationServiceUrlParam = defineString(
  "RECOMMENDATION_SERVICE_URL",
  {
    default: "http://localhost:8100",
    description: "URL of the TaleTribe recommendation service",
  },
);

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const auth = isEmulator ? null : new GoogleAuth();

export class RecommendationServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(`Recommendation service returned HTTP ${status}`);
    this.name = "RecommendationServiceError";
  }
}

export function getRecommendationServiceUrl(): string {
  const url = recommendationServiceUrlParam.value().replace(/\/$/, "");
  if (!url) {
    throw new Error("RECOMMENDATION_SERVICE_URL must be configured");
  }
  if (!isEmulator && /localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      "RECOMMENDATION_SERVICE_URL cannot point to localhost in production",
    );
  }
  return url;
}

async function identityToken(audience: string): Promise<string | null> {
  if (isEmulator || /localhost|127\.0\.0\.1/.test(audience)) return null;
  if (!auth) return null;
  const client = await auth.getIdTokenClient(audience);
  const headers = await client.getRequestHeaders();
  return headers.Authorization?.split(" ")[1] ?? null;
}

/**
 * POST a JSON request to recs. The Firebase Function is the trust boundary:
 * callers never receive the Cloud Run URL or its Google identity token.
 */
export async function callRecommendationService<T>(
  path: string,
  body: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const baseUrl = getRecommendationServiceUrl();
  const token = await identityToken(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload: unknown = await response.json().catch(() => ({
    error: "Recommendation service returned an unreadable response",
  }));
  if (!response.ok) {
    throw new RecommendationServiceError(response.status, payload);
  }
  return payload as T;
}
