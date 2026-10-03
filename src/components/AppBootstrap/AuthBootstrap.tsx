import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { configureStoryData } from "@novelsync/story-data-client";
import { auth, getAuthContext, getCurrentUid } from "@novelsync/platform-auth";
import { appQueryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores";
import { prefetchGuestbookRoute } from "@/routes/Guestbook/prefetchGuestbook";
import { prefetchUserStories } from "@/routes/Story/prefetchUserStories";

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
        // The assistant transcript lives in the panel's local runtime and is
        // torn down with it on sign-out, so only cached queries need clearing.
        appQueryClient.clear();
        useAuthStore.setState({ user: null, loading: !!nextUid });
      }
      previousUidRef.current = nextUid;

      // Identity is known before profile/follow hydration. Request the first
      // feed page while those reads and the lazy route chunk are in flight.
      void prefetchGuestbookRoute(window.location.pathname, nextUid);
      if (window.location.pathname === "/user-stories") {
        prefetchUserStories(nextUid);
      }

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
