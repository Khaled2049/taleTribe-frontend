import { Navigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthIdentity } from "@novelsync/platform-auth";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { Button } from "@/components/ui/button";
import {
  OwnershipCheck,
  ownershipKey,
  ownershipOutcome,
  workspaceAccess,
} from "@/lib/workspaceAccess";
import Story from "./Story/Story";

/**
 * Gates on the Firebase identity rather than the hydrated profile in
 * authStore: that store reports `user: null` until the profile and follow
 * graph load, which a cold refresh would read as signed out.
 */
const PrivateRoute = () => {
  const identity = useAuthIdentity();
  const { storyId } = useParams();
  const [check, setCheck] = useState<OwnershipCheck | null>(null);
  const [attempt, setAttempt] = useState(0);
  const uid = identity.loading ? null : identity.uid;

  useEffect(() => {
    if (!uid || !storyId) return;
    const key = ownershipKey(uid, storyId);
    let cancelled = false;

    storyWorkspaceRepo
      .getStory(storyId)
      .then((story) => {
        if (!cancelled)
          setCheck({ key, outcome: ownershipOutcome(story, uid) });
      })
      .catch((error) => {
        console.error("Error checking story ownership:", error);
        if (!cancelled) setCheck({ key, outcome: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [uid, storyId, attempt]);

  const access = workspaceAccess(identity, storyId, check);

  if (access === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent" />
      </div>
    );
  }

  if (access === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen bg-ns-bg font-ui text-ns-ink">
        <p>We couldn't open this story. Check your connection and try again.</p>
        <Button
          onClick={() => {
            setCheck(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return access === "owner" ? <Story /> : <Navigate to="/user-stories" />;
};

export default PrivateRoute;
