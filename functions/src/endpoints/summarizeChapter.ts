/** Chapter summarization endpoint (synchronous). */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireStoryOwnership } from "../infra/authService";
import { callAgentWithRetry } from "../agent/retry";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";
import {
  getStoryDataChapter,
  putStoryDataSummary,
  StoryDataRequestError,
} from "../infra/storyDataClient";

/**
 * POST /summarizeChapter - Summarize a chapter and persist the summary.
 *
 * Reads the chapter from story-data, asks the agent for a short continuity
 * summary, and writes it back under the chapter's revision. Synchronous
 * (summaries are quick), returns the summary in the response.
 */
export const summarizeChapter = onRequest(
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

      const { chapterId } = request.body;
      if (!chapterId || typeof chapterId !== "string") {
        response
          .status(400)
          .json({ error: "chapterId is required and must be a string" });
        return;
      }

      let chapter: Awaited<ReturnType<typeof getStoryDataChapter>>;
      try {
        chapter = await getStoryDataChapter(storyId, chapterId, idToken, userId);
      } catch (error) {
        // Only a real 404 is "no such chapter"; anything else is story-data
        // being unreachable, which must not be reported as a missing chapter.
        if (error instanceof StoryDataRequestError && error.status === 404) {
          response.status(404).json({ error: "Chapter not found" });
          return;
        }
        throw error;
      }

      const content = chapter.content;
      if (!content.trim()) {
        response
          .status(400)
          .json({ error: "Chapter has no content to summarize" });
        return;
      }

      const agentResponse = await callAgentWithRetry(
        "summarizeChapter",
        { storyId, content, chapterId },
        3,
        1000,
        userId,
        access.providerConfig ?? undefined,
        idToken,
      );

      if (!agentResponse.success || !agentResponse.data) {
        response.status(500).json({
          error: agentResponse.error || "Failed to summarize chapter",
          details: agentResponse.error,
        });
        return;
      }

      // Unwrap envelope if the agent returned { success, data: { summary } }.
      const raw = agentResponse.data as Record<string, unknown>;
      const unwrapped = (raw.data != null ? raw.data : raw) as {
        summary?: string;
      };
      const summary =
        typeof unwrapped.summary === "string" ? unwrapped.summary.trim() : "";

      if (!summary) {
        response.status(500).json({ error: "Agent returned no summary" });
        return;
      }

      await putStoryDataSummary(storyId, chapterId, summary, chapter.revision, idToken, userId);

      response.status(200).json({ summary });
    } catch (error) {
      logger.error("Error in summarizeChapter", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }),
);
