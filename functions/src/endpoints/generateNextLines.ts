import { onRequest } from "firebase-functions/v2/https";
import { callAgentWithRetry } from "../agent/retry";
import { requireStoryOwnership } from "../infra/authService";
import * as logger from "firebase-functions/logger";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";

const MAX_CONTENT_LENGTH = 5000;

export const generateNextLines = onRequest(
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

      const { content, cursorPosition, chapterId } = request.body;

      // Validate required parameters
      if (!content || typeof content !== "string") {
        response.status(400).json({
          error: "content is required and must be a string",
        });
        return;
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        response.status(400).json({
          error: `content is too long (max ${MAX_CONTENT_LENGTH} characters)`,
        });
        return;
      }

      if (cursorPosition === undefined || typeof cursorPosition !== "number") {
        response.status(400).json({
          error: "cursorPosition is required and must be a number",
        });
        return;
      }

      // Call agent synchronously
      const agentResponse = await callAgentWithRetry("generateNextLines", {
        storyId,
        content,
        cursorPosition,
        chapterId,
      }, 3, 1000, userId, access.providerConfig ?? undefined, idToken);

      if (!agentResponse.success || !agentResponse.data) {
        response.status(500).json({
          error: agentResponse.error || "Failed to generate next lines",
          details: agentResponse.error,
        });
        return;
      }

      response.status(200).json(agentResponse.data);
    } catch (error) {
      logger.error("Error in generateNextLines", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  })
);
