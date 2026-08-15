import { create } from "zustand";
import { User as FirebaseUser } from "firebase/auth";
import { firestore } from "@/config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { IUser } from "@/types/IUser";
import { profileRepo } from "@/services/ProfileRepo";
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

        let hydratedUser = newUser;
        const profileUsername =
          typeof userData.username === "string" && userData.username.trim().length > 0
            ? userData.username
            : firebaseUser.displayName || "";
        if (profileUsername) {
          try {
            let profile = await profileRepo.getMe();
            if (!profile) {
              profile = await profileRepo.createMe({ username: profileUsername, photoURL: firebaseUser.photoURL || "", bio: typeof userData.bio === "string" ? userData.bio : "", occupation: typeof userData.occupation === "string" ? userData.occupation : "", location: typeof userData.location === "string" ? userData.location : "", walletAddress: typeof userData.walletAddress === "string" ? userData.walletAddress : "" });
            }
            const follows = await profileRepo.getMyFollows();
            hydratedUser = {
              ...newUser,
              username: profile.username,
              photoURL: profile.photoURL || firebaseUser.photoURL,
              bio: profile.bio ?? "",
              occupation: profile.occupation ?? "",
              location: profile.location ?? "",
              walletAddress: profile.walletAddress,
              following: follows.following,
              followers: follows.followers,
            };
          } catch (publicProfileError) {
            console.warn(
              "Error syncing public profile during hydration:",
              publicProfileError,
            );
          }
        }
        set({ user: hydratedUser, loading: false });
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
      await profileRepo.setFollow(uid, true);

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
      await profileRepo.setFollow(uid, false);

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
      if (currentUser.username) {
        await profileRepo.updateMe({ bio });
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

    // The API owns case-insensitive username uniqueness.
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
      data = { ...data, username: nextUsername };
    }
    try {
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(filteredData).length === 0) return;

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
        await profileRepo.updateMe(publicProfileData);
      }
      const privateData = Object.fromEntries(Object.entries(filteredData).filter(([key]) => key === "firstName" || key === "lastName" || key === "writingInterests"));
      if (Object.keys(privateData).length) await updateDoc(doc(firestore, "users", currentUser.uid), privateData);

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
      console.error("Error updating user profile:", error);
      if (error instanceof Error && error.message.includes("username already taken")) {
        throw new Error("That username is already taken.");
      }
      throw new Error("Failed to update user profile");
    }
  },
}));
