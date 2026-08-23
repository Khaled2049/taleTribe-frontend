import { useState } from "react";
import {
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  updateProfile,
  updatePassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, firestore } from "@novelsync/platform-auth";
import { storageService } from "@/services/StorageService";
import { profileRepo } from "@novelsync/story-data-client";

/** Optional profile details collected during the signup wizard. */
export interface SignupProfile {
  firstName?: string;
  lastName?: string;
  bio?: string;
  occupation?: string;
  location?: string;
  writingInterests?: string;
  photoFile?: File;
}

export const useFirebaseAuth = () => {
  const [error, setError] = useState<string | null>(null);

  const createUserDocument = async (
    userId: string,
    userData: {
      username: string;
      email: string;
      isAnonymous?: boolean;
      walletAddress?: string;
      firstName?: string;
      lastName?: string;
      bio?: string;
      occupation?: string;
      location?: string;
      writingInterests?: string;
      photoURL?: string;
    },
  ) => {
    // username lives in story-data (below); Firebase Auth's displayName,
    // already set by completeMagicLinkSignup's updateProfile() call before
    // this runs, is the bootstrap source until that profile loads (see
    // authStore.hydrateUser) — no need for a third copy here.
    const dbUser = {
      email: userData.email,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      isAnonymous: userData.isAnonymous || false,
    };
    await setDoc(doc(firestore, "users", userId), dbUser);
    await profileRepo.createMe({
      username: userData.username,
      photoURL: userData.photoURL || "",
      firstName: userData.firstName?.trim() || "",
      lastName: userData.lastName?.trim() || "",
      bio: userData.bio?.trim() || "",
      occupation: userData.occupation?.trim() || "",
      location: userData.location?.trim() || "",
      writingInterests: userData.writingInterests?.trim() || "",
      walletAddress: userData.walletAddress || "",
    });
  };

  /**
   * Request an invite by creating a pending invite document.
   * Returns success status and any error message.
   */
  const requestInvite = async (
    email: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      // Check if invite already exists
      const inviteRef = doc(firestore, "invites", email);
      const existingInvite = await getDoc(inviteRef);

      if (existingInvite.exists()) {
        const data = existingInvite.data();
        const status = data.status;

        if (status === "pending") {
          return {
            success: false,
            message: "An invite request for this email is already pending.",
          };
        }
        if (status === "approved" || status === "sent") {
          return {
            success: false,
            message:
              "Your invite has been approved! Check your email for the magic link.",
          };
        }
        if (status === "completed") {
          return {
            success: false,
            message:
              "An account with this email already exists. Please sign in.",
          };
        }
        if (status === "rejected") {
          return {
            success: false,
            message: "This invite request was declined.",
          };
        }
      }

      // Create invite request
      await setDoc(inviteRef, {
        email,
        status: "pending",
        requestedAt: serverTimestamp(),
        linkSentCount: 0,
      });

      setError(null);
      return { success: true };
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      return { success: false, message };
    }
  };

  /**
   * Complete sign-up using a magic link.
   * This is called after the user clicks the magic link in their email.
   */
  const completeMagicLinkSignup = async (
    email: string,
    username: string,
    password: string,
    profile?: SignupProfile,
    walletAddress?: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const link = window.location.href;

      // Verify the link is a valid sign-in link
      if (!isSignInWithEmailLink(auth, link)) {
        return { success: false, message: "Invalid or expired magic link." };
      }

      // Sign in with the magic link
      const result = await signInWithEmailLink(auth, email, link);
      const user = result.user;

      // Upload the profile image if one was chosen. Optional — never block signup.
      let photoURL: string | undefined;
      if (profile?.photoFile) {
        try {
          photoURL = await storageService.uploadProfileImage(
            profile.photoFile,
            user.uid,
          );
        } catch (uploadErr) {
          console.warn("Profile image upload failed, continuing:", uploadErr);
        }
      }

      // Update Firebase Auth profile (username + optional avatar)
      await updateProfile(user, {
        displayName: username,
        ...(photoURL ? { photoURL } : {}),
      });

      // Set the password for future sign-ins
      await updatePassword(user, password);

      // Create user document in Firestore
      await createUserDocument(user.uid, {
        username,
        email,
        isAnonymous: false,
        walletAddress,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        bio: profile?.bio,
        occupation: profile?.occupation,
        location: profile?.location,
        writingInterests: profile?.writingInterests,
        ...(photoURL ? { photoURL } : {}),
      });

      // Mark invite as completed
      const inviteRef = doc(firestore, "invites", email);
      await updateDoc(inviteRef, {
        status: "completed",
        completedAt: serverTimestamp(),
      });

      setError(null);
      return { success: true };
    } catch (err) {
      const error = err as { code?: string; message: string };

      if (error.code === "auth/invalid-action-code") {
        const message =
          "This link has expired or already been used. Please request a new invite.";
        setError(message);
        return { success: false, message };
      }
      if (error.code === "auth/expired-action-code") {
        const message = "This link has expired. Please request a new invite.";
        setError(message);
        return { success: false, message };
      }
      if (error.code === "auth/weak-password") {
        const message =
          "Password is too weak. Please choose a stronger password.";
        setError(message);
        return { success: false, message };
      }

      setError(error.message);
      return { success: false, message: error.message };
    }
  };

  /**
   * Check if the current URL is a valid magic link.
   */
  const isMagicLink = (): boolean => {
    return isSignInWithEmailLink(auth, window.location.href);
  };

  const signin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Update last login time
      const user = auth.currentUser;

      if (user) {
        await setDoc(
          doc(firestore, "users", user.uid),
          {
            lastLogin: new Date().toISOString(),
          },
          { merge: true },
        );
      }
      setError(null);
      return { status: 200 };
    } catch (err) {
      console.log("err", err);
      setError((err as Error).message);
      return { status: "error" };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const signout = async () => {
    try {
      await signOut(auth);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return {
    requestInvite,
    completeMagicLinkSignup,
    isMagicLink,
    signin,
    signout,
    forgotPassword,
    error,
  };
};
