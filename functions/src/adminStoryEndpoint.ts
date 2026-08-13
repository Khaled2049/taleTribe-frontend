import { randomUUID } from "crypto";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { ensureAdmin } from "./adminAuth";
import { corsOptions } from "./corsConfig";
import { createStoryByAdminSchema, STORY_LIMITS } from "./adminStorySchemas";
import { AdminStoryError, createStoryAggregate } from "./adminStoryService";

const db = admin.firestore();

export const createStoryByAdmin = onRequest(corsOptions, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const correlationId = randomUUID();
  const startedAt = Date.now();
  try {
    const adminToken = await ensureAdmin(request.headers.authorization);
    const requestBytes = Buffer.byteLength(JSON.stringify(request.body ?? {}), "utf8");
    if (requestBytes > STORY_LIMITS.requestBytes) {
      throw new AdminStoryError(413, "Request body is too large", "request_too_large");
    }

    const parsed = createStoryByAdminSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({
        error: "Invalid story payload",
        code: "validation_failed",
        correlationId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await createStoryAggregate(db, parsed.data);
    logger.info("Admin story import completed", {
      correlationId,
      adminUid: adminToken.uid,
      ownerUid: parsed.data.ownerUid,
      storyId: result.response.storyId,
      chapterCount: parsed.data.chapters.length,
      characterCount: parsed.data.characters.length,
      placeCount: parsed.data.places.length,
      plotCount: parsed.data.plots.length,
      isPublished: parsed.data.story.isPublished,
      idempotentReplay: !result.created,
      durationMs: Date.now() - startedAt,
    });
    response.status(result.created ? 201 : 200).json({
      success: true,
      correlationId,
      ...result.response,
    });
  } catch (error) {
    const statusCode = error instanceof AdminStoryError ? error.statusCode : Number(
      (error as { statusCode?: number })?.statusCode,
    ) || 500;
    const code = error instanceof AdminStoryError ? error.code : "internal_error";
    const safeMessage = statusCode < 500 && error instanceof Error ? error.message : "Failed to create story";
    logger.error("Admin story import failed", {
      correlationId,
      statusCode,
      code,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    response.status(statusCode).json({ error: safeMessage, code, correlationId });
  }
});
