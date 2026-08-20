import { getStoryDataConfig } from "./config";
import {
  StoryDataAuthError,
  StoryDataConflictError,
  StoryDataError,
} from "./errors";

export type AuthMode = "none" | "optional" | "required";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /**
   * "optional" is not the same as "none": a signed-in reader still sends their
   * token to a public endpoint so the server can fill in per-viewer fields
   * (`likedByMe`, `userVote`) instead of defaulting them.
   */
  auth?: AuthMode;
  /** Sent as `If-Match`. Only the endpoints with revision guards pass it. */
  revision?: number;
  /**
   * Adds `X-Admin` for competition host actions. Gated on the same dev flag as
   * `X-User-ID`, because story-data only honours either under `AUTH_MODE=dev`.
   */
  devAdmin?: boolean;
  /** Prefix for the generated error message, e.g. "Story request". */
  label?: string;
  signal?: AbortSignal;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = "none",
    revision,
    devAdmin = false,
    label = "story-data request",
    signal,
  } = options;
  const { baseUrl, getAuthContext, sendDevUserHeader } = getStoryDataConfig();

  const headers: Record<string, string> = {};

  // Set only alongside a body: an unauthenticated GET with no headers stays a
  // CORS-simple request, and public reads depend on not paying a preflight.
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth !== "none") {
    const context = await getAuthContext();
    if (!context && auth === "required") throw new StoryDataAuthError();
    if (context) {
      if (context.token) headers.Authorization = `Bearer ${context.token}`;
      if (sendDevUserHeader) {
        headers["X-User-ID"] = context.uid;
        if (devAdmin) headers["X-Admin"] = "true";
      }
    }
  }

  if (revision !== undefined) headers["If-Match"] = String(revision);

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || `${label} failed (${response.status})`;
    if (response.status === 409) throw new StoryDataConflictError(message);
    throw new StoryDataError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
