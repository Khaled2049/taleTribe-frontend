import { onRequest } from "firebase-functions/v2/https";
import { requireStoryOwnership } from "../infra/authService";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";
import {
  agentHeaders,
  getAgentServiceUrl,
  getIdentityToken,
} from "../agent/transport";
import * as logger from "firebase-functions/logger";

/** Triggered only after the editor receives a successful chapter save. */
export const learnStoryVoice = onRequest(
  { ...corsWithEncryption, timeoutSeconds: 130 },
  requireStoryOwnership(async (request, response, userId, storyId, idToken) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "POST required" });
      return;
    }
    const chapterId = request.body?.chapterId;
    const sourceRevision = request.body?.sourceRevision;
    if (
      typeof chapterId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(chapterId) ||
      !Number.isSafeInteger(sourceRevision) ||
      sourceRevision < 1
    ) {
      response
        .status(400)
        .json({ error: "Valid chapterId and sourceRevision required" });
      return;
    }
    try {
      const identityToken = await getIdentityToken();
      const endpoint = `${getAgentServiceUrl()}/voice-learning/pass`;
      const headers = agentHeaders(identityToken, idToken);
      const base = {
        user_id: userId,
        story_id: storyId,
        chapter_id: chapterId,
        source_revision: sourceRevision,
      };
      // Preflight checks the switch, revisions, evidence availability and
      // per-story rate cap before consuming the member's daily AI quota.
      const check = await fetch(`${endpoint}?preflight=true`, {
        method: "POST",
        headers,
        body: JSON.stringify(base),
      });
      if (!check.ok) {
        response
          .status(check.status)
          .json({ error: "Voice learning unavailable" });
        return;
      }
      const eligibility = (await check.json()) as { eligible?: boolean };
      if (!eligibility.eligible) {
        response.status(200).json({ status: "skipped" });
        return;
      }
      const access = await checkAiAccess(userId);
      if (!access.allowed) {
        response
          .status(access.suspended ? 403 : 402)
          .json({ error: access.reason || "AI access unavailable" });
        return;
      }
      const result = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...base,
          provider_config: access.providerConfig ?? undefined,
        }),
      });
      if (!result.ok) {
        response
          .status(result.status)
          .json({ error: "Voice learning unavailable" });
        return;
      }
      response.status(200).json(await result.json());
    } catch (error) {
      logger.warn("voice learning request failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
      response.status(503).json({ error: "Voice learning unavailable" });
    }
  }),
);
