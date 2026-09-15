import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { requireStoryOwnership } from "../infra/authService";
import {
  checkAiAccess,
  corsWithEncryption,
  describeAiAccess,
  type ProviderConfig,
} from "../domain/aiSettings";
import { assistantFlags } from "../domain/assistantFlags";
import { relayAssistantStream } from "../agent/stream";
import {
  agentHeaders,
  getAgentServiceUrl,
  getIdentityToken,
} from "../agent/transport";

/**
 * Assemble what the agent receives.
 *
 * Identity, the authorized story and the provider credentials are pinned here:
 * the body is spread first and the trusted values assigned after, so a
 * browser-supplied `userId`, `storyId` or `provider_config` is inert rather
 * than merged. A caller with no BYOK settings sends no key at all, which is
 * what makes the run bill platform credits.
 */
export function buildRunRequest(
  body: unknown,
  trusted: {
    storyId: string;
    userId: string;
    providerConfig: ProviderConfig | null;
  },
): Record<string, unknown> {
  const base =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return {
    ...base,
    storyId: trusted.storyId,
    userId: trusted.userId,
    provider_config: trusted.providerConfig ?? undefined,
  };
}

const NO_MODEL_CONTINUATION_DECISIONS = new Set([
  "applied",
  "rejected",
  "apply_failed",
]);

/** Whether this request can start model work and must consume daily quota. */
export function assistantRunConsumesQuota(body: unknown): boolean {
  if (!body || typeof body !== "object") return true;
  const continuation = (body as Record<string, unknown>).continuation;
  if (!continuation || typeof continuation !== "object") return true;
  const decision = (continuation as Record<string, unknown>).decision;
  return (
    typeof decision !== "string" ||
    !NO_MODEL_CONTINUATION_DECISIONS.has(decision)
  );
}

/** Relay one owner-authorized assistant run without buffering its SSE body. */
export async function handleAssistantRun(request: Request, response: Response) {
  const flags = assistantFlags();
  if (!flags.api) {
    response.status(404).json({ error: "Assistant API is disabled" });
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ error: "POST required" });
    return;
  }
  const body =
    request.body && typeof request.body === "object"
      ? (request.body as Record<string, unknown>)
      : null;
  if (body?.continuation != null && !flags.edits) {
    response.status(404).json({ error: "Assistant edits are disabled" });
    return;
  }
  await requireStoryOwnership(async (req, res, userId, storyId, idToken) => {
    // Applied/rejected/failed continuations only settle an existing approval.
    // Revision requests start fresh model work and consume quota like new runs.
    const access = assistantRunConsumesQuota(req.body)
      ? await checkAiAccess(userId)
      : await describeAiAccess(userId);
    if (!access.allowed) {
      // 402, not 429: the browser maps 402 to quota_exceeded and reserves 429
      // for rate limiting, which would tell a user who has spent the day's
      // allowance to "try again shortly". The reason is ours, never an
      // upstream body.
      res
        .status(402)
        .json({ error: access.reason || "Daily AI quota exceeded" });
      return;
    }
    const runRequest = buildRunRequest(req.body, {
      storyId,
      userId,
      providerConfig: access.providerConfig,
    });
    await relayAssistantStream(
      res,
      async (signal) => {
        const identityToken = await getIdentityToken();
        return fetch(`${getAgentServiceUrl()}/assistant/run`, {
          method: "POST",
          headers: agentHeaders(identityToken, idToken),
          body: JSON.stringify(runRequest),
          signal,
        });
      },
      125_000,
    );
  })(request, response);
}

export const assistantRun = onRequest(
  { ...corsWithEncryption, timeoutSeconds: 130 },
  handleAssistantRun,
);
