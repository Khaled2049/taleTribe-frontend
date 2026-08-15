/** Chapter summarization endpoint (synchronous). */
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { requireStoryOwnership } from "./authService";
import { callAgentWithRetry } from "./agentService";
import { checkAiAccess, corsWithEncryption } from "./aiSettings";
import { getStoryDataChapter, putStoryDataSummary } from "./storyDataClient";

const db = admin.firestore();

/**
 * POST /summarizeChapter - Summarize a chapter and persist the summary.
 *
 * Reads the chapter content, asks the agent for a short continuity summary, and
 * writes it back to `stories/{storyId}/chapters/{chapterId}.summary`. Synchronous
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

      const chapterRef = db
        .collection("stories")
        .doc(storyId)
        .collection("chapters")
        .doc(chapterId);
      let pgChapter: Awaited<ReturnType<typeof getStoryDataChapter>> | null = null;
      try { pgChapter = await getStoryDataChapter(storyId, chapterId, idToken, userId); } catch { /* legacy Firestore story */ }
      const chapterSnap = pgChapter ? null : await chapterRef.get();
      if (!pgChapter && !chapterSnap?.exists) { response.status(404).json({ error: "Chapter not found" }); return; }
      const content = pgChapter ? pgChapter.content : (chapterSnap?.data()?.content ?? "").toString();
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

      if (pgChapter) {
        await putStoryDataSummary(storyId, chapterId, summary, pgChapter.revision, idToken, userId);
      } else {
        await chapterRef.set({ summary, summarizedAt: Timestamp.now() }, { merge: true });
      }

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
