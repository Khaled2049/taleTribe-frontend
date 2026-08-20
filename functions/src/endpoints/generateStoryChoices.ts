/** AI-powered interactive storytelling: generates an opening scene or narrative direction choices. */
import { onRequest } from "firebase-functions/v2/https";
import { callAgentWithRetry } from "../agent/retry";
import { requireStoryOwnership } from "../infra/authService";
import * as logger from "firebase-functions/logger";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";

const VALID_MODES = ["opening", "continuation", "ending"] as const;
type StoryChoicesMode = (typeof VALID_MODES)[number];
const MAX_CURRENT_CONTENT_LENGTH = 5000;

/**
 * POST /generateStoryChoices
 *
 * Generates an opening scene (first call) or continuation choices (subsequent calls)
 * for the interactive co-write storytelling mode. Requires story ownership.
 *
 * Request body:
 *   storyId: string         — picked up by requireStoryOwnership
 *   mode: "opening" | "continuation"
 *   currentContent?: string — HTML content already in editor (empty for opening)
 *   chapterId?: string
 *
 * Response:
 *   openingScene?: string   — only present when mode === "opening"
 *   choices: { label: string, sceneText: string }[]  — 3–4 items
 */
export const generateStoryChoices = onRequest(
  corsWithEncryption,
  requireStoryOwnership(async (request, response, userId, storyId, idToken) => {
    try {
      // ── Quota check (bypassed for BYOK users) ─────────────────────────────
      const access = await checkAiAccess(userId);
      if (!access.allowed) {
        response.status(429).json({
          error: access.reason || "Daily AI quota exceeded",
        });
        return;
      }
      // ── Validate request ────────────────────────────────────────────────────
      const { mode, currentContent, chapterId, turnCount } = request.body as {
        mode?: string;
        currentContent?: string;
        chapterId?: string;
        turnCount?: number;
      };

      if (!mode || !VALID_MODES.includes(mode as StoryChoicesMode)) {
        response.status(400).json({
          error: `mode must be one of: ${VALID_MODES.join(", ")}`,
        });
        return;
      }
      if (currentContent !== undefined && typeof currentContent !== "string") {
        response.status(400).json({
          error: "currentContent must be a string when provided",
        });
        return;
      }
      if ((currentContent ?? "").length > MAX_CURRENT_CONTENT_LENGTH) {
        response.status(400).json({
          error: `currentContent is too long (max ${MAX_CURRENT_CONTENT_LENGTH} characters)`,
        });
        return;
      }

      // ── Call agent ──────────────────────────────────────────────────────────
      const agentResponse = await callAgentWithRetry("generateStoryChoices", {
        storyId,
        userId,
        mode,
        currentContent: currentContent ?? "",
        chapterId,
        turnCount: turnCount ?? 0,
      }, 3, 1000, userId, access.providerConfig ?? undefined, idToken);

      if (!agentResponse.success || !agentResponse.data) {
        response.status(500).json({
          error: agentResponse.error || "Failed to generate story choices",
          details: agentResponse.error,
        });
        return;
      }

      response.status(200).json(agentResponse.data);
    } catch (error) {
      logger.error("Error in generateStoryChoices", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }),
);
