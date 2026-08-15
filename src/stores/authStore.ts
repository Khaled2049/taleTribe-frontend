import { create } from "zustand";
import { User as FirebaseUser } from "firebase/auth";
import { firestore } from "@/config/firebase";
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { IUser } from "@/types/IUser";
import { publicProfileService } from "@/services/PublicProfileService";
import { usernameKey, usernameService } from "@/services/UsernameService";
import { appQueryClient } from "@/lib/queryClient";
import { queryKeys } from "@/hooks/queries/queryKeys";

export interface ProfileUpdateData {
  username?: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  bio?: string;
  occupation?: string;
  location?: string;
  writingInterests?: string;
}

export interface AuthStore {
  user: IUser | null;
  loading: boolean;
  hydrateUser: (firebaseUser: FirebaseUser | null) => Promise<void>;
  followUser: (uid: string) => Promise<void>;
  unfollowUser: (uid: string) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
}

/**
 * Older accounts seeded `followers`/`following` with the literal string
 * "default". It matches no uid, so it is harmless to the wall-policy checks, but
 * it inflates any length and renders as a ghost row. A user cannot strip it from
 * their own `followers` — the rules forbid self-writes to that field — so it is
 * filtered on read here and cleared by `backfill-follow-graph.js`.
 */
const realUids = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id !== "default")
    : [];

const getFallbackUser = (firebaseUser: FirebaseUser): IUser => ({
  ...firebaseUser,
  createdAt: new Date().toISOString(),
  username: firebaseUser.displayName || "",
  followers: [],
  following: [],
  stories: [],
  likedPosts: [],
  savedPosts: [],
  lastLogin: new Date().toISOString(),
  bio: "Write an about me section here...",
  occupation: "Occupation",
  location: "Location",
  walletAddress: undefined,
  aiUsage: 0,
  lastAiUsageDate: "",
});

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: true,
  hydrateUser: async (firebaseUser) => {
    if (!firebaseUser) {
      set({ user: null, loading: false });
      return;
    }

    try {
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const tokenResult = await firebaseUser.getIdTokenResult();
        const newUser: IUser = {
          ...firebaseUser,
          ...userData,
          createdAt: userData.createdAt,
          username: userData.username,
          firstName:
            typeof userData.firstName === "string"
              ? userData.firstName
              : undefined,
          lastName:
            typeof userData.lastName === "string"
              ? userData.lastName
              : undefined,
          followers: realUids(userData.followers),
          following: realUids(userData.following),
          stories: userData.stories ?? [],
          likedPosts: userData.likedPosts,
          savedPosts: userData.savedPosts,
          lastLogin: userData.lastLogin,
          bio: userData.bio,
          occupation: userData.occupation,
          location: userData.location,
          writingInterests: userData.writingInterests,
          walletAddress: userData.walletAddress,
          hasCustomAiProvider: userData.hasCustomAiProvider === true,
          isAdmin: tokenResult.claims["admin"] === true,
          aiUsage: typeof userData.aiUsage === "number" ? userData.aiUsage : 0,
          lastAiUsageDate:
            typeof userData.lastAiUsageDate === "string"
              ? userData.lastAiUsageDate
              : "",
        };

        const profileUsername =
          typeof userData.username === "string" && userData.username.trim().length > 0
            ? userData.username
            : firebaseUser.displayName || "";
        if (profileUsername) {
          try {
            // Accounts created before the usernames index exists hold no claim,
            // which would let anyone else take their name. Backfill once on
            // login. Best-effort: "taken" here means two accounts already share
            // a name and needs resolving by hand, but must not block sign-in.
            const claim = await usernameService.claim(
              profileUsername,
              firebaseUser.uid,
            );
            if (claim === "taken") {
              console.warn(
                `Username "${profileUsername}" is already claimed by another account.`,
              );
            }

            const existingPublicProfile =
              await publicProfileService.getPublicProfile(firebaseUser.uid);
            // createdAt doubles as a schema-version sentinel: docs written before
            // profile fields went public lack it, so backfill them once on login.
            if (!existingPublicProfile || !existingPublicProfile.createdAt) {
              await publicProfileService.upsertPublicProfile(firebaseUser.uid, {
                username: profileUsername,
                ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
                ...(typeof userData.bio === "string" ? { bio: userData.bio } : {}),
                ...(typeof userData.occupation === "string"
                  ? { occupation: userData.occupation }
                  : {}),
                ...(typeof userData.location === "string"
                  ? { location: userData.location }
                  : {}),
                ...(typeof userData.createdAt === "string"
                  ? { createdAt: userData.createdAt }
                  : {}),
              });
            }
          } catch (publicProfileError) {
            console.warn(
              "Error syncing public profile during hydration:",
              publicProfileError,
            );
          }
        }
        set({ user: newUser, loading: false });
        return;
      }

      set({ user: getFallbackUser(firebaseUser), loading: false });
    } catch (error) {
      console.error("Error hydrating authenticated user:", error);
      set({ user: null, loading: false });
      throw error;
    }
  },
  followUser: async (uid) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    // The rules reject a follow that is already recorded (`!followers.hasAny`),
    // so a redundant call is a guaranteed failure, not a no-op.
    if ((currentUser.following ?? []).includes(uid)) return;

    try {
      // One batch, not two writes: the two arrays are read by different
      // consumers — the rules check the target's `followers`, the UI checks the
      // viewer's `following` — so a half-applied follow makes them disagree.
      // Rules evaluate each document in a batch independently, so the existing
      // follower and self-update branches still apply.
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, "users", uid), {
        followers: arrayUnion(currentUser.uid),
      });
      batch.update(doc(firestore, "users", currentUser.uid), {
        following: arrayUnion(uid),
      });
      await batch.commit();

      set((state) => ({
        user: state.user
          ? { ...state.user, following: [...(state.user.following ?? []), uid] }
          : null,
      }));
    } catch (error) {
      console.error("Error following user:", error);
      throw new Error("Failed to follow user");
    }
  },
  unfollowUser: async (uid) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    if (!(currentUser.following ?? []).includes(uid)) return;

    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, "users", uid), {
        followers: arrayRemove(currentUser.uid),
      });
      batch.update(doc(firestore, "users", currentUser.uid), {
        following: arrayRemove(uid),
      });
      await batch.commit();

      set((state) => ({
        user: state.user
          ? {
              ...state.user,
              following: (state.user.following ?? []).filter((id) => id !== uid),
            }
          : null,
      }));
    } catch (error) {
      console.error("Error unfollowing user:", error);
      throw new Error("Failed to unfollow user");
    }
  },
  updateBio: async (bio) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    try {
      const userDocRef = doc(firestore, "users", currentUser.uid);
      await updateDoc(userDocRef, { bio });
      if (currentUser.username) {
        await publicProfileService.upsertPublicProfile(currentUser.uid, {
          username: currentUser.username,
          bio,
        });
        // Refresh the live-resolved public profile so the owner's own surfaces
        // (author bios, etc.) reflect the change without waiting out staleTime.
        appQueryClient.invalidateQueries({
          queryKey: queryKeys.user.publicProfile(currentUser.uid),
        });
      }
      set((state) => ({
        user: state.user ? { ...state.user, bio } : null,
      }));
    } catch (error) {
      console.error("Error updating user bio:", error);
      throw new Error("Failed to update user profile");
    }
  },
  updateProfile: async (data) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    // Validate a username change and claim it before writing. Claiming first is
    // what serializes concurrent claimants; if the profile write below fails we
    // release the claim rather than stranding the name. Thrown errors propagate
    // to the caller (e.g. the inline editor) so the specific message is shown.
    let previousUsername: string | undefined;
    let claimedUsername: string | undefined;
    if (
      typeof data.username === "string" &&
      data.username !== currentUser.username
    ) {
      const nextUsername = data.username.trim();
      if (nextUsername.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }
      if (!/^[a-zA-Z0-9_]+$/.test(nextUsername)) {
        throw new Error(
          "Username can only contain letters, numbers, and underscores.",
        );
      }
      const claim = await usernameService.claim(nextUsername, currentUser.uid);
      if (claim === "taken") {
        throw new Error("That username is already taken.");
      }
      // Only a claim this call created is ours to roll back — "already-owned"
      // covers re-casing (alice -> Alice), which maps to the same index doc.
      if (claim === "claimed") {
        claimedUsername = nextUsername;
      }
      previousUsername = currentUser.username;
      data = { ...data, username: nextUsername };
    }

    let userDocWritten = false;
    try {
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(filteredData).length === 0) return;

      const userDocRef = doc(firestore, "users", currentUser.uid);
      await updateDoc(userDocRef, filteredData);
      userDocWritten = true;

      const publicProfileData: {
        username?: string;
        photoURL?: string;
        bio?: string;
        occupation?: string;
        location?: string;
      } = {};
      if (typeof filteredData.username === "string") {
        publicProfileData.username = filteredData.username;
      }
      if (typeof filteredData.photoURL === "string") {
        publicProfileData.photoURL = filteredData.photoURL;
      }
      if (typeof filteredData.bio === "string") {
        publicProfileData.bio = filteredData.bio;
      }
      if (typeof filteredData.occupation === "string") {
        publicProfileData.occupation = filteredData.occupation;
      }
      if (typeof filteredData.location === "string") {
        publicProfileData.location = filteredData.location;
      }
      if (Object.keys(publicProfileData).length > 0) {
        const usernameToSync = publicProfileData.username ?? currentUser.username;
        if (usernameToSync) {
          await publicProfileService.upsertPublicProfile(currentUser.uid, {
            username: usernameToSync,
            ...(publicProfileData.photoURL
              ? { photoURL: publicProfileData.photoURL }
              : {}),
            ...(publicProfileData.bio !== undefined
              ? { bio: publicProfileData.bio }
              : {}),
            ...(publicProfileData.occupation !== undefined
              ? { occupation: publicProfileData.occupation }
              : {}),
            ...(publicProfileData.location !== undefined
              ? { location: publicProfileData.location }
              : {}),
          });
        }
      }

      // Release the previous username so it becomes available again. Compare
      // index keys, not display casing: re-casing alice -> Alice keeps the same
      // mapping, and releasing it would drop the claim we still hold.
      if (
        previousUsername &&
        typeof filteredData.username === "string" &&
        usernameKey(previousUsername) !== usernameKey(filteredData.username)
      ) {
        await usernameService.release(previousUsername);
      }

      // Refresh the live-resolved public profile so every surface that shows
      // this author's username/photo (feed, comments, story cards/bios) picks
      // up the change immediately instead of waiting out the query staleTime.
      appQueryClient.invalidateQueries({
        queryKey: queryKeys.user.publicProfile(currentUser.uid),
      });

      set((state) => {
        if (!state.user) return state;
        return {
          user: {
            ...state.user,
            ...filteredData,
          },
        };
      });
    } catch (error) {
      // The claim landed but the user doc never did, so nothing references the
      // name. Release it, or it stays permanently unavailable to everyone else
      // (rules only let the holding uid delete it). If the user doc did commit,
      // keep the claim — it now backs a name the account actually uses, even
      // though a later step here failed.
      if (claimedUsername && !userDocWritten) {
        await usernameService.release(claimedUsername);
      }
      console.error("Error updating user profile:", error);
      throw new Error("Failed to update user profile");
    }
  },
}));
