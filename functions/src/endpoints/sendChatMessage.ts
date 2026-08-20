/** Chat message endpoint for AI-powered story assistance. */
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { requireStoryOwnership } from "../infra/authService";
import { callAgentWithRetry } from "../agent/retry";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";
import {
  getChatHistory,
  saveChatMessages,
  getOrCreateChatSession,
} from "../domain/chatFirestore";

const MAX_CHAT_MESSAGE_LENGTH = 5000;

/**
 * POST /sendChatMessage
 * Send a chat message with story context for RAG-powered response.
 *
 * Request body:
 * - storyId: string (required, validated by middleware)
 * - chatId?: string (optional, will be created if not provided)
 * - message: string (required)
 *
 * Story context is NOT sent from here — the agent assembles a slim, bounded
 * context itself (denormalized chapter index + vector-retrieved excerpts).
 *
 * Response:
 * - response: string (AI-generated response)
 * - chatId: string (chat session ID)
 * - contextUsed: { chapters, characters, plots, places }
 */
export const sendChatMessage = onRequest(
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

      const { chatId, message } = request.body;

      // Validate message
      if (!message || typeof message !== "string" || message.trim() === "") {
        response.status(400).json({
          error: "message is required and must be a non-empty string",
        });
        return;
      }
      if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
        response.status(400).json({
          error: `message is too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)`,
        });
        return;
      }

      const db = admin.firestore();

      // Get or create chat session
      let sessionId = chatId;
      if (!sessionId) {
        sessionId = await getOrCreateChatSession(db, storyId, userId);
        logger.info("Created new chat session", { storyId, chatId: sessionId });
      }

      // Fetch chat history (last 10 messages for conversational context)
      const chatHistory = await getChatHistory(db, storyId, sessionId, 10);
      logger.info("Fetched chat history", {
        storyId,
        chatId: sessionId,
        messageCount: chatHistory.length,
      });

      // Call Python agent with retry
      const agentResponse = await callAgentWithRetry(
        "chatWithContext",
        {
          storyId,
          userId,
          message: message.trim(),
          chatHistory: chatHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        },
        3,
        1000,
        userId,
        access.providerConfig ?? undefined,
        idToken,
      );

      if (!agentResponse.success || !agentResponse.data) {
        logger.error("Agent failed to generate chat response", {
          storyId,
          chatId: sessionId,
          error: agentResponse.error,
        });
        response.status(500).json({
          error: agentResponse.error || "Failed to generate chat response",
          details: agentResponse.error,
        });
        return;
      }

      const responseData = (agentResponse.data as any).data;

      // Save user message and assistant response to Firestore. There is no
      // contextSnapshot: it required reading every context doc up front, and the
      // agent now selects context per message via vector retrieval, so a Node-side
      // ID list wouldn't reflect what was actually used.
      await saveChatMessages(
        db,
        storyId,
        sessionId,
        userId,
        message.trim(),
        responseData.response,
      );

      logger.info("Chat message processed successfully", {
        storyId,
        chatId: sessionId,
        messageLength: message.length,
        responseLength: responseData.response.length,
      });

      // Return response
      response.status(200).json({
        response: responseData.response,
        chatId: sessionId,
        contextUsed: responseData.contextUsed || {
          chapters: 0,
          characters: 0,
          plots: 0,
          places: 0,
        },
      });
    } catch (error) {
      logger.error("Error in sendChatMessage", {
        error,
        storyId,
        userId,
      });
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }),
);
