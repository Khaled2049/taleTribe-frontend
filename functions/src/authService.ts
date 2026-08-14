/** Authentication and authorization utilities. */
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import * as logger from "firebase-functions/logger";

/**
 * Verify Firebase authentication token and get user ID.
 */
export async function verifyAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    logger.error("Error verifying auth token", error);
    return null;
  }
}

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

/**
 * Check if user owns the story.
 */
export async function verifyStoryOwnership(
  db: admin.firestore.Firestore,
  storyId: string,
  userId: string
): Promise<boolean> {
  try {
    const storyDoc = await db.collection("stories").doc(storyId).get();

    if (!storyDoc.exists) {
      return false;
    }

    const storyData = storyDoc.data();
    return storyData?.userId === userId;
  } catch (error) {
    logger.error("Error verifying story ownership", error);
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

export interface AdminAuthContext extends AuthContext {
  decoded: admin.auth.DecodedIdToken & { admin?: boolean };
}

/**
 * Verify the caller holds the `admin` custom claim.
 *
 * Throws `{statusCode: 401 | 403}`-shaped errors so it can be used directly
 * inside a handler that already has a try/catch, as adminUserService does.
 * Prefer `requireAdmin` for new endpoints.
 */
export async function ensureAdmin(
  authHeader: string | undefined,
): Promise<AdminAuthContext> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  const idToken = authHeader.split("Bearer ")[1];
  const decoded = (await admin
    .auth()
    .verifyIdToken(idToken)) as admin.auth.DecodedIdToken & { admin?: boolean };

  if (!decoded.admin) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  return { userId: decoded.uid, idToken, decoded };
}

/**
 * Middleware to require authentication AND the `admin` custom claim.
 *
 * The claim is the only real gate — a `disabled` attribute in the UI is not one.
 * Anything that moves tokens or decides who receives them belongs behind this.
 */
export function requireAdmin(
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

    let context: AdminAuthContext;
    try {
      context = await ensureAdmin(request.headers.authorization);
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode) || 401;
      response
        .status(statusCode)
        .json({ error: statusCode === 403 ? "Forbidden" : "Unauthorized" });
      return;
    }

    await handler(request, response, context.userId, context.idToken);
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

    const db = admin.firestore();
    const ownsStory = await verifyStoryOwnership(db, storyId, authContext.userId);

    if (!ownsStory) {
      response
        .status(403)
        .json({ error: "Forbidden: Story not found or access denied" });
      return;
    }

    await handler(request, response, authContext.userId, storyId, authContext.idToken);
  };
}
