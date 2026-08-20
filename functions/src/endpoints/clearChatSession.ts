/** Endpoint to clear a chat session and all associated brain memory. */
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { requireStoryOwnership } from "../infra/authService";
import { deleteChatSession } from "../domain/chatFirestore";
import { corsOptions } from "../infra/corsConfig";

/**
 * POST /clearChatSession
 * Deletes all messages in the chat session and clears the story-scoped brain memory.
 *
 * Request body:
 * - storyId: string (required, validated by middleware)
 * - chatId: string (required)
 */
export const clearChatSession = onRequest(
  corsOptions,
  requireStoryOwnership(async (request, response, userId, storyId, idToken) => {
    try {
      const { chatId } = request.body;

      if (!chatId || typeof chatId !== "string") {
        response.status(400).json({ error: "chatId is required" });
        return;
      }

      const db = admin.firestore();

      // Delete Firestore chat messages + session doc
      await deleteChatSession(db, storyId, chatId);

      logger.info("Chat session cleared", { storyId, chatId, userId });
      response.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error in clearChatSession", { error, storyId: request.body?.storyId });
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }),
);
