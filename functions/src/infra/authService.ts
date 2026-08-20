/** Authentication and authorization utilities. */
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import * as logger from "firebase-functions/logger";

export interface AuthContext {
  userId: string;
  idToken: string;
}

export async function verifyAuthContext(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return { userId: decodedToken.uid, idToken };
  } catch (error) {
    logger.error("Error verifying auth token", error);
    return null;
  }
}

/** Stories live in story-data, which authorizes them with the caller's original
 * Firebase token. This is the only ownership check — there is no Firestore
 * story document to fall back to. */
async function verifyStoryDataOwnership(storyId: string, userId: string, idToken: string): Promise<boolean> {
  const baseUrl = (process.env.STORY_DATA_URL || "http://localhost:8084").replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/v1/stories/${encodeURIComponent(storyId)}`, {
      // X-User-ID is accepted only by story-data AUTH_MODE=dev; production
      // verifies the Firebase bearer token and ignores it.
      headers: { Authorization: `Bearer ${idToken}`, "X-User-ID": userId },
    });
    return response.ok;
  } catch (error) {
    logger.warn("story-data ownership lookup failed", { storyId, error });
    return false;
  }
}

/**
 * Middleware to require authentication.
 */
export function requireAuth(
  handler: (
    request: Request,
    response: Response,
    userId: string,
    idToken: string
  ) => Promise<void>
) {
  return async (request: Request, response: Response): Promise<void> => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    const authContext = await verifyAuthContext(request);
    if (!authContext) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    await handler(request, response, authContext.userId, authContext.idToken);
  };
}

/**
 * Middleware to require authentication and story ownership.
 */
export function requireStoryOwnership(
  handler: (
    request: Request,
    response: Response,
    userId: string,
    storyId: string,
    idToken: string
  ) => Promise<void>
) {
  return async (request: Request, response: Response): Promise<void> => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    const authContext = await verifyAuthContext(request);
    if (!authContext) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const storyId = request.body?.storyId || request.query?.storyId;

    if (!storyId || typeof storyId !== "string") {
      response.status(400).json({ error: "storyId is required" });
      return;
    }

    const ownsStory = await verifyStoryDataOwnership(
      storyId,
      authContext.userId,
      authContext.idToken,
    );

    if (!ownsStory) {
      response
        .status(403)
        .json({ error: "Forbidden: Story not found or access denied" });
      return;
    }

    await handler(request, response, authContext.userId, storyId, authContext.idToken);
  };
}
