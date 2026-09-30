import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthIdentity } from "@novelsync/platform-auth";
import { Button } from "@/components/ui/button";
import { workspaceStoryQuery } from "@/hooks/queries/workspaceStory";
import { workspaceAccess } from "@/lib/workspaceAccess";
import Story from "./Story/Story";

/**
 * Gates on the Firebase identity rather than the hydrated profile in
 * authStore: that store reports `user: null` until the profile and follow
 * graph load, which a cold refresh would read as signed out.
 */
const PrivateRoute = () => {
  const identity = useAuthIdentity();
  const { storyId } = useParams();
  const uid = identity.loading ? null : identity.uid;

  const story = useQuery({
    ...workspaceStoryQuery(uid ?? "", storyId ?? ""),
    enabled: !!uid && !!storyId,
  });

  const access = workspaceAccess(identity, storyId, story);

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
        <Button onClick={() => void story.refetch()}>Try again</Button>
      </div>
    );
  }

  return access === "owner" ? <Story /> : <Navigate to="/user-stories" />;
};

export default PrivateRoute;
