/**
 * How Functions reach the Python agent service: where it lives, how we
 * authenticate to it, and the error shapes both call paths share.
 *
 * Split out of the old `agentService.ts` because `callAgent` and
 * `callAgentPath` had copied the header block, the error-envelope parsing, and
 * the connection-refused help text between them — the last one three times.
 */
import * as logger from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";
import { GoogleAuth } from "google-auth-library";

const agentServiceUrlParam = defineString("AGENT_SERVICE_URL", {
  default: "http://localhost:8000",
  description: "URL of the Python agent service (Cloud Run or local)",
});

export const isLocalDevelopment = process.env.FUNCTIONS_EMULATOR === "true";

export function getAgentServiceUrl(): string {
  const url = agentServiceUrlParam.value();
  if (!url) {
    throw new Error("AGENT_SERVICE_URL must be set in production");
  }
  return url.replace(/\/$/, "");
}

// Only needed off-emulator: Cloud Run wants a signed identity token.
const auth = isLocalDevelopment ? null : new GoogleAuth();

export class FetchError extends Error {
  code?: string;
  response?: { status: number; statusText: string; data: unknown };

  constructor(
    message: string,
    options?: {
      code?: string;
      response?: { status: number; statusText: string; data: unknown };
    },
  ) {
    super(message);
    this.name = "FetchError";
    this.code = options?.code;
    this.response = options?.response;
  }
}

/** Identity token for Cloud Run. Null locally, where the service is unguarded. */
export async function getIdentityToken(): Promise<string | null> {
  const url = getAgentServiceUrl();
  if (isLocalDevelopment || url.includes("localhost")) {
    return null;
  }

  try {
    if (!auth) return null;
    const client = await auth.getIdTokenClient(url);
    const headers = await client.getRequestHeaders();
    return headers.Authorization?.split(" ")[1] || null;
  } catch (error) {
    logger.error("Error getting identity token", error);
    return null;
  }
}

/**
 * Two tokens, two purposes: the identity token authenticates *this service* to
 * Cloud Run, while `X-Firebase-Token` forwards the *end user* so the agent can
 * meter their credits.
 */
export function agentHeaders(
  identityToken: string | null,
  firebaseToken?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (identityToken) headers.Authorization = `Bearer ${identityToken}`;
  if (firebaseToken) headers["X-Firebase-Token"] = firebaseToken;
  return headers;
}

/**
 * Pull the agent's own message and code out of a failed response envelope. The
 * agent sends `{ error: string }` or `{ error: { message, code } }`; a code is
 * what `callAgentWithRetry` uses to decide a retry is pointless.
 */
export function parseAgentError(error: FetchError): {
  message: string | null;
  code: string | undefined;
} {
  const payload = error.response?.data as { error?: unknown } | undefined;
  const agentError = payload?.error;

  if (typeof agentError === "string") {
    return { message: agentError, code: undefined };
  }
  if (agentError && typeof agentError === "object") {
    const shaped = agentError as { message?: unknown; code?: unknown };
    return {
      message: typeof shaped.message === "string" ? shaped.message : null,
      code: typeof shaped.code === "string" ? shaped.code : undefined,
    };
  }
  return { message: null, code: undefined };
}

/** ECONNREFUSED is nearly always one of two misconfigurations; name both. */
export function connectionRefusedHelp(agentUrl: string): string {
  return isLocalDevelopment
    ? `Connection refused to ${agentUrl}. ` +
        `Make sure the Python agent service is running locally on port 8000. ` +
        `Start it with: cd python && python server.py`
    : `Connection refused to ${agentUrl}. ` +
        `This usually means AGENT_SERVICE_URL environment variable is not set ` +
        `or is set to localhost. Please set it to your Cloud Run service URL ` +
        `(e.g., https://story-agent-xxxxx.run.app) in Firebase Console → ` +
        `Functions → Configuration → Environment variables.`;
}
