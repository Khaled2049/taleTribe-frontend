import { create } from "zustand";
import {
  User as FirebaseUser,
  updateProfile as updateFirebaseAuthProfile,
} from "firebase/auth";
import { auth, firestore } from "@novelsync/platform-auth";
import { doc, getDoc } from "firebase/firestore";
import { IUser } from "@/types/IUser";
import { profileRepo } from "@novelsync/story-data-client";
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
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
}

const getFallbackUser = (firebaseUser: FirebaseUser): IUser => ({
  ...firebaseUser,
  createdAt: new Date().toISOString(),
  username: firebaseUser.displayName || "",
  followers: [],
  following: [],
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
        // username lives in story-data now; Firebase Auth's displayName (set
        // at signup, kept in sync by updateProfile — see authStore.updateProfile)
        // is the bootstrap source until the story-data profile loads below.
        const seedUsername =
          typeof userData.username === "string" &&
          userData.username.trim().length > 0
            ? userData.username
            : firebaseUser.displayName || "";
        const newUser: IUser = {
          ...firebaseUser,
          ...userData,
          createdAt: userData.createdAt,
          username: seedUsername,
          followers: [],
          following: [],
          lastLogin: userData.lastLogin,
          bio: userData.bio,
          occupation: userData.occupation,
          location: userData.location,
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
        const profileUsername = seedUsername;
        if (profileUsername) {
          try {
            let profile = await profileRepo.getMe();
            if (!profile) {
              // Self-heal for a Firestore doc with no story-data profile yet.
              // Also carries firstName/lastName/writingInterests forward from
              // any pre-migration Firestore doc that still has them.
              profile = await profileRepo.createMe({
                username: profileUsername,
                photoURL: firebaseUser.photoURL || "",
                firstName:
                  typeof userData.firstName === "string"
                    ? userData.firstName
                    : "",
                lastName:
                  typeof userData.lastName === "string"
                    ? userData.lastName
                    : "",
                bio: typeof userData.bio === "string" ? userData.bio : "",
                occupation:
                  typeof userData.occupation === "string"
                    ? userData.occupation
                    : "",
                location:
                  typeof userData.location === "string"
                    ? userData.location
                    : "",
                writingInterests:
                  typeof userData.writingInterests === "string"
                    ? userData.writingInterests
                    : "",
                walletAddress:
                  typeof userData.walletAddress === "string"
                    ? userData.walletAddress
                    : "",
              });
            }
            const follows = await profileRepo.getMyFollows();
            hydratedUser = {
              ...newUser,
              username: profile.username,
              photoURL: profile.photoURL || firebaseUser.photoURL,
              firstName: profile.firstName || undefined,
              lastName: profile.lastName || undefined,
              bio: profile.bio ?? "",
              occupation: profile.occupation ?? "",
              location: profile.location ?? "",
              writingInterests: profile.writingInterests,
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
    // story-data inserts `ON CONFLICT DO NOTHING`, so a repeat follow is
    // harmless; this just saves the round trip.
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
              following: (state.user.following ?? []).filter(
                (id) => id !== uid,
              ),
            }
          : null,
      }));
    } catch (error) {
      console.error("Error unfollowing user:", error);
      throw new Error("Failed to unfollow user");
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
        firstName?: string;
        lastName?: string;
        bio?: string;
        occupation?: string;
        location?: string;
        writingInterests?: string;
      } = {};
      if (typeof filteredData.username === "string") {
        publicProfileData.username = filteredData.username;
      }
      if (typeof filteredData.photoURL === "string") {
        publicProfileData.photoURL = filteredData.photoURL;
      }
      if (typeof filteredData.firstName === "string") {
        publicProfileData.firstName = filteredData.firstName;
      }
      if (typeof filteredData.lastName === "string") {
        publicProfileData.lastName = filteredData.lastName;
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
      if (typeof filteredData.writingInterests === "string") {
        publicProfileData.writingInterests = filteredData.writingInterests;
      }
      if (Object.keys(publicProfileData).length > 0) {
        await profileRepo.updateMe(publicProfileData);
      }

      // Firebase Auth's own displayName/photoURL are set once at signup and
      // otherwise unused, but keeping them current avoids a stale copy
      // surfacing through firebaseUser.displayName/.photoURL fallbacks
      // (e.g. getFallbackUser, or before the story-data profile loads).
      if (
        auth.currentUser &&
        (publicProfileData.username !== undefined ||
          publicProfileData.photoURL !== undefined)
      ) {
        await updateFirebaseAuthProfile(auth.currentUser, {
          ...(publicProfileData.username !== undefined
            ? { displayName: publicProfileData.username }
            : {}),
          ...(publicProfileData.photoURL !== undefined
            ? { photoURL: publicProfileData.photoURL }
            : {}),
        });
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
      console.error("Error updating user profile:", error);
      if (
        error instanceof Error &&
        error.message.includes("username already taken")
      ) {
        throw new Error("That username is already taken.");
      }
      throw new Error("Failed to update user profile");
    }
  },
}));
