import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { configureStoryData } from "@novelsync/story-data-client";
import { auth, getAuthContext, getCurrentUid } from "@novelsync/platform-auth";
import { appQueryClient } from "@/lib/queryClient";
import { useAuthStore, useChatStore } from "@/stores";

// Runs at module load, not in an effect: a repo call can be issued by a route
// loader before any component mounts, and an unconfigured client throws.
configureStoryData({
  baseUrl: import.meta.env.VITE_STORY_DATA_URL || "/story-data",
  sendDevUserHeader: import.meta.env.DEV,
  getAuthContext,
  getUid: getCurrentUid,
});

export const AuthBootstrap = () => {
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const nextUid = firebaseUser?.uid ?? null;

      if (
        previousUidRef.current !== null &&
        previousUidRef.current !== nextUid
      ) {
        appQueryClient.clear();
        useChatStore.getState().resetChatState();
      }
      previousUidRef.current = nextUid;

      try {
        await useAuthStore.getState().hydrateUser(firebaseUser);
      } catch (error) {
        console.error("Failed to hydrate auth state:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
};
