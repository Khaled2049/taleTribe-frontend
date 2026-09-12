import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { requireStoryOwnership } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import { assistantFlags } from "../domain/assistantFlags";
import { relayAssistantStream } from "../agent/stream";
import {
  agentHeaders,
  getAgentServiceUrl,
  getIdentityToken,
} from "../agent/transport";

/**
 * Transport proof for the v1 assistant protocol: fixed mock events, no model
 * call, AI credits, or writes.
 *
 * The gateway is the trust boundary. `requireStoryOwnership` verifies the
 * Firebase token and the story before anything is forwarded, and `userId` is
 * taken from that verification rather than from the request body — the browser
 * sends a `RunRequest`, which has no identity field, and agents receives an
 * `AgentRunRequest`, which adds exactly one.
 */
export async function handleAssistantStreamSpike(
  request: Request,
  response: Response,
) {
  if (!assistantFlags().spike) {
    response
      .status(404)
      .json({ error: "Assistant transport spike is disabled" });
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ error: "POST required" });
    return;
  }
  await requireStoryOwnership(async (req, res, userId, storyId, idToken) => {
    // Forward the browser's run request verbatim, with the verified uid added
    // and storyId pinned to the one ownership was actually checked against.
    const runRequest = {
      ...(req.body ?? {}),
      storyId,
      userId,
    };
    await relayAssistantStream(res, async (signal) => {
      const identityToken = await getIdentityToken();
      return fetch(`${getAgentServiceUrl()}/assistant/spike`, {
        method: "POST",
        headers: agentHeaders(identityToken, idToken),
        body: JSON.stringify(runRequest),
        signal,
      });
    });
  })(request, response);
}

// Retained to reproduce the Firebase emulator cancellation comparison in the ADR.
export const assistantStreamSpike = onRequest(
  { ...corsOptions, timeoutSeconds: 30 },
  handleAssistantStreamSpike,
);
