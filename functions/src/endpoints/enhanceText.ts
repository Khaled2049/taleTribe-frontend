import { onRequest } from "firebase-functions/v2/https";
import { callAgentWithRetry } from "../agent/retry";
import { requireStoryOwnership } from "../infra/authService";
import * as logger from "firebase-functions/logger";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";

export const enhanceText = onRequest(
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

      const { action, selectedText, chapterId } = request.body;

      // Validate required parameters
      if (!action || typeof action !== "string") {
        response.status(400).json({
          error: "action is required and must be a string",
        });
        return;
      }

      const validActions = ["expand", "dialogue", "rewrite"];
      if (!validActions.includes(action)) {
        response.status(400).json({
          error: `action must be one of: ${validActions.join(", ")}`,
        });
        return;
      }

      if (!selectedText || typeof selectedText !== "string") {
        response.status(400).json({
          error: "selectedText is required and must be a string",
        });
        return;
      }

      // Validate text length (prevent abuse)
      if (selectedText.length > 5000) {
        response.status(400).json({
          error: "Selected text is too long (max 5000 characters)",
        });
        return;
      }

      if (selectedText.trim().length === 0) {
        response.status(400).json({
          error: "Selected text cannot be empty",
        });
        return;
      }

      // Call agent synchronously
      const agentResponse = await callAgentWithRetry("enhanceText", {
        storyId,
        action,
        selectedText,
        chapterId,
      }, 3, 1000, userId, access.providerConfig ?? undefined, idToken);

      if (!agentResponse.success || !agentResponse.data) {
        response.status(500).json({
          error: agentResponse.error || "Failed to enhance text",
          details: agentResponse.error,
        });
        return;
      }

      response.status(200).json(agentResponse.data);
    } catch (error) {
      logger.error("Error in enhanceText", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  })
);
