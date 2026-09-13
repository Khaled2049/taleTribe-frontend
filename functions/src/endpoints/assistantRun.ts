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

/** Relay one owner-authorized assistant run without buffering its SSE body. */
export async function handleAssistantRun(request: Request, response: Response) {
  if (!assistantFlags().api) {
    response.status(404).json({ error: "Assistant API is disabled" });
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ error: "POST required" });
    return;
  }
  await requireStoryOwnership(async (req, res, userId, storyId, idToken) => {
    // Identity and the authorized story are pinned at this trust boundary;
    // neither value can be supplied or overridden by the browser/model.
    const runRequest = {
      ...(req.body ?? {}),
      storyId,
      userId,
    };
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
  { ...corsOptions, timeoutSeconds: 130 },
  handleAssistantRun,
);
