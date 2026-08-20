import { auth } from "./firebase";

export interface AuthContext {
  uid: string;
  token: string | null;
}

/**
 * The async token provider handed to `configureStoryData`. Kept here so
 * story-data-client never imports firebase — see that package's config.ts.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return { uid: user.uid, token: await user.getIdToken() };
}

/**
 * Synchronous uid, for the mappers that stamp ownership onto a decoded entity
 * and cannot await. Returns null between sign-out and the next auth callback,
 * so callers that need a guaranteed uid should use `getAuthContext`.
 */
export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}
