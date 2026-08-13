import * as admin from "firebase-admin";

export interface DecodedAdminToken extends admin.auth.DecodedIdToken {
  admin?: boolean;
}

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
}

/** Verify that a request carries a Firebase ID token with the admin custom claim. */
export async function ensureAdmin(
  authHeader: string | undefined,
): Promise<DecodedAdminToken> {
  const token = getBearerToken(authHeader);
  if (!token) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  let decoded: DecodedAdminToken;
  try {
    decoded = (await admin
      .auth()
      .verifyIdToken(token)) as DecodedAdminToken;
  } catch {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  if (!decoded.admin) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  return decoded;
}
