/** Brainstorming endpoints (synchronous). */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireStoryOwnership } from "./authService";
import { callAgentWithRetry } from "./agentService";
import { checkAiAccess, corsWithEncryption } from "./aiSettings";

/**
 * POST /brainstormIdeas - Generate brainstorming ideas (synchronous).
 */
export const brainstormIdeas = onRequest(
  corsWithEncryption,
  requireStoryOwnership(async (request, response, userId, storyId, idToken) => {
    try {
      const access = await checkAiAccess(userId);
      if (!access.allowed) {
        response.status(429).json({
          error: access.reason || "Daily AI quota exceeded",
        });
        return;
      }

      const { type, prompt, count } = request.body;

      if (!type || typeof type !== "string") {
        response.status(400).json({
          error:
            "type is required and must be one of: characters, plots, places, themes",
        });
        return;
      }

      const validTypes = ["characters", "plots", "places", "themes"];
      if (!validTypes.includes(type)) {
        response.status(400).json({
          error: `type must be one of: ${validTypes.join(", ")}`,
        });
        return;
      }

      const ideaCount = count && typeof count === "number" ? count : 5;

      // Call agent synchronously
      const agentResponse = await callAgentWithRetry("brainstormIdeas", {
        storyId,
        type,
        prompt,
        count: ideaCount,
      }, 3, 1000, userId, access.providerConfig ?? undefined, idToken);

      if (!agentResponse.success || !agentResponse.data) {
        response.status(500).json({
          error: agentResponse.error || "Failed to generate ideas",
          details: agentResponse.error,
        });
        return;
      }

      response.status(200).json(agentResponse.data);
    } catch (error) {
      logger.error("Error in brainstormIdeas", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  })
);
