import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { randomInt, randomBytes } from "crypto";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { corsOptions } from "./corsConfig";
import { ensureAdmin as ensureAdminAuth } from "./authService";
import { buildUserProfileDefaults } from "./userProfileDefaults";

const db = admin.firestore();

interface CreateUserByAdminRequest {
  email?: string;
}

interface SetUserAdminRequest {
  email?: string;
  uid?: string;
  isAdmin?: boolean;
}

interface InviteDoc {
  linkSentCount?: number;
}

interface DecodedAdminToken extends admin.auth.DecodedIdToken {
  admin?: boolean;
}

function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function buildRandomPassword(): string {
  return randomBytes(20).toString("base64url");
}

function buildRandomUsername(): string {
  const baseName = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: "_",
    style: "lowerCase",
    length: 2,
  });
  const suffix = randomInt(10, 99);
  return `${baseName}_${suffix}`;
}

async function isUsernameTaken(username: string): Promise<boolean> {
  const snapshot = await db
    .collection("usernames")
    .doc(username.trim().toLowerCase())
    .get();
  return snapshot.exists;
}

async function generateUniqueUsername(maxAttempts = 20): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const username = buildRandomUsername();
    const taken = await isUsernameTaken(username);

    if (!taken) {
      return username;
    }
  }

  throw Object.assign(new Error("Unable to generate unique username"), {
    statusCode: 409,
  });
}

/**
 * Thin wrapper over the shared `ensureAdmin` in authService, kept so the call
 * sites here can go on using the decoded token directly (e.g. `adminToken.uid`).
 */
async function ensureAdmin(
  authHeader: string | undefined,
): Promise<DecodedAdminToken> {
  const { decoded } = await ensureAdminAuth(authHeader);
  return decoded as DecodedAdminToken;
}

export const createUserByAdmin = onRequest(
  corsOptions,
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const adminToken = await ensureAdmin(request.headers.authorization);
      const { email } = (request.body || {}) as CreateUserByAdminRequest;
      const normalizedEmail = (email || "").trim().toLowerCase();

      if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        response.status(400).json({ error: "A valid email is required" });
        return;
      }

      try {
        await admin.auth().getUserByEmail(normalizedEmail);
        response
          .status(409)
          .json({ error: "A user with this email already exists" });
        return;
      } catch (error) {
        const authError = error as { code?: string };
        if (authError.code !== "auth/user-not-found") {
          throw error;
        }
      }

      const username = await generateUniqueUsername();
      const password = buildRandomPassword();

      const createdUser = await admin.auth().createUser({
        email: normalizedEmail,
        password,
        displayName: username,
        emailVerified: true,
      });

      let firestoreCommitted = false;
      try {
        const userDoc = buildUserProfileDefaults({
          username,
          email: normalizedEmail,
        });
        const usernameRef = db
          .collection("usernames")
          .doc(username.trim().toLowerCase());
        const userRef = db.collection("users").doc(createdUser.uid);
        const publicProfileRef = db
          .collection("publicProfiles")
          .doc(createdUser.uid);
        const inviteRef = db.collection("invites").doc(normalizedEmail);

        await db.runTransaction(async (transaction) => {
          const usernameSnapshot = await transaction.get(usernameRef);
          if (usernameSnapshot.exists) {
            throw Object.assign(
              new Error("Generated username is already taken"),
              {
                statusCode: 409,
              },
            );
          }
          const inviteSnapshot = await transaction.get(inviteRef);
          const inviteData = inviteSnapshot.data() as InviteDoc | undefined;

          transaction.create(usernameRef, { uid: createdUser.uid });
          transaction.create(userRef, userDoc);
          transaction.set(publicProfileRef, {
            username,
            // The other writer is PublicProfileService.upsertPublicProfile.
            // KEEP IN SYNC: rules require usernameLower == username.lower().
            usernameLower: username.trim().toLowerCase(),
            bio: userDoc.bio,
            occupation: userDoc.occupation,
            location: userDoc.location,
            createdAt: userDoc.createdAt,
            updatedAt: userDoc.createdAt,
          });
          transaction.set(
            inviteRef,
            {
              email: normalizedEmail,
              status: "completed",
              completedAt: FieldValue.serverTimestamp(),
              approvedAt: FieldValue.serverTimestamp(),
              sentAt: FieldValue.serverTimestamp(),
              approvedBy: adminToken.uid,
              linkSentCount:
                typeof inviteData?.linkSentCount === "number"
                  ? inviteData.linkSentCount
                  : 0,
            },
            { merge: true },
          );
        });
        firestoreCommitted = true;

        let passwordResetLink: string | null = null;
        let warning: string | undefined;
        try {
          passwordResetLink = await admin
            .auth()
            .generatePasswordResetLink(normalizedEmail);
        } catch (error) {
          warning =
            "User was created, but the password reset link could not be generated";
          logger.warn(
            "Password reset link generation failed after user creation",
            {
              uid: createdUser.uid,
              error,
            },
          );
        }

        response.status(200).json({
          success: true,
          uid: createdUser.uid,
          email: normalizedEmail,
          username,
          passwordResetLink,
          ...(warning ? { warning } : {}),
        });
      } catch (error) {
        if (!firestoreCommitted) {
          try {
            await admin.auth().deleteUser(createdUser.uid);
          } catch (cleanupError) {
            logger.error(
              "Failed to clean up Auth user after Firestore failure",
              {
                uid: createdUser.uid,
                cleanupError,
              },
            );
          }
        }
        throw error;
      }
    } catch (error) {
      const statusCode =
        Number((error as { statusCode?: number })?.statusCode) || 500;
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create user account";

      logger.error("Error creating user by admin", {
        statusCode,
        message,
      });

      response.status(statusCode).json({ error: message });
    }
  },
);

export const setUserAdmin = onRequest(
  corsOptions,
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      await ensureAdmin(request.headers.authorization);

      const {
        email,
        uid,
        isAdmin = true,
      } = (request.body || {}) as SetUserAdminRequest;
      const normalizedEmail = (email || "").trim().toLowerCase();
      const normalizedUid = (uid || "").trim();

      if (!normalizedEmail && !normalizedUid) {
        response.status(400).json({ error: "Either email or uid is required" });
        return;
      }

      const userRecord = normalizedUid
        ? await admin.auth().getUser(normalizedUid)
        : await admin.auth().getUserByEmail(normalizedEmail);

      const currentClaims = userRecord.customClaims || {};
      const updatedClaims = { ...currentClaims };

      if (isAdmin) {
        updatedClaims.admin = true;
      } else {
        delete updatedClaims.admin;
      }

      await admin.auth().setCustomUserClaims(userRecord.uid, updatedClaims);

      response.status(200).json({
        success: true,
        uid: userRecord.uid,
        email: userRecord.email || null,
        isAdmin: Boolean(updatedClaims.admin),
        message:
          "Custom claims updated. User must refresh token (sign out/in) to apply.",
      });
    } catch (error) {
      const authError = error as { code?: string; statusCode?: number };
      let statusCode = Number(authError?.statusCode) || 500;

      if (authError?.code === "auth/user-not-found") {
        statusCode = 404;
      }

      const message =
        error instanceof Error ? error.message : "Failed to update admin claim";

      logger.error("Error setting admin claim", {
        statusCode,
        message,
      });

      response.status(statusCode).json({ error: message });
    }
  },
);
