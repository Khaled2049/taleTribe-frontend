/** HTTP endpoint to reserve a daily Storage upload slot before client upload. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import { reserveUserStorageUpload } from "../domain/storageUploadService";

/**
 * POST /reserveStorageUpload
 * Reserves one slot against the user's daily Storage upload quota.
 */
export const reserveStorageUpload = onRequest(
  corsOptions,
  requireAuth(async (request, response, userId) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const result = await reserveUserStorageUpload(userId);
      if (!result.allowed) {
        response.status(429).json({
          error: result.reason || "Daily upload limit reached",
          limit: result.limit,
        });
        return;
      }

      response.status(200).json({
        allowed: true,
        count: result.count,
        limit: result.limit,
      });
    } catch (error) {
      logger.error("reserveStorageUpload endpoint error", { userId, error });
      response.status(500).json({ error: "Failed to reserve upload slot" });
    }
  }),
);
