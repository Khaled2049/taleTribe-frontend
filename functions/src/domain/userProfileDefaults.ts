import { FieldValue } from "firebase-admin/firestore";

/**
 * The follow graph, likedPosts/savedPosts and the story list are deliberately
 * absent: `user_follows` and `public_profiles` in story-data own the first, and
 * nothing has ever read the rest. bio/occupation/location stay because
 * `authStore.hydrateUser` seeds the story-data profile from them on first
 * sign-in.
 */
export interface UserProfileDefaultsInput {
  username: string;
  email: string;
  walletAddress?: string;
}

export interface UserProfileDocument {
  username: string;
  email: string;
  createdAt: string;
  lastLogin: string;
  isAnonymous: boolean;
  aiUsage: number;
  lastAiUsageDate: string;
  bio: string;
  occupation: string;
  location: string;
  walletAddress?: string;
  updatedAt: FieldValue;
}

export function buildUserProfileDefaults(
  input: UserProfileDefaultsInput
): UserProfileDocument {
  const nowIso = new Date().toISOString();
  const today = nowIso.split("T")[0];

  return {
    username: input.username,
    email: input.email,
    createdAt: nowIso,
    lastLogin: nowIso,
    isAnonymous: false,
    aiUsage: 0,
    lastAiUsageDate: today,
    bio: "Write an about me section here...",
    occupation: "Occupation",
    location: "Location",
    ...(input.walletAddress ? { walletAddress: input.walletAddress } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
}
