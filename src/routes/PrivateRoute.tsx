import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthIdentity } from "@novelsync/platform-auth";
import { Button } from "@/components/ui/button";
import { EditorWorkspaceSkeleton } from "@/components/editor/EditorWorkspaceSkeleton";
import {
  workspaceChapterIndexQuery,
  workspaceChapterQuery,
  workspaceStoryQuery,
} from "@/hooks/queries/workspaceStory";
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
  const [searchParams] = useSearchParams();
  const requestedChapterId = searchParams.get("chapter");
  const uid = identity.loading ? null : identity.uid;

  const story = useQuery({
    ...workspaceStoryQuery(uid ?? "", storyId ?? ""),
    enabled: !!uid && !!storyId,
  });

  // Runs beside the ownership read so the editor's index is not a second
  // sequential round trip. The endpoint enforces its own read access.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!uid || !storyId) return;
    void queryClient.prefetchQuery(workspaceChapterIndexQuery(uid, storyId));
  }, [queryClient, uid, storyId]);

  const requestedChapterRef = useRef(requestedChapterId);
  requestedChapterRef.current = requestedChapterId;
  useEffect(() => {
    const chapterId = requestedChapterRef.current;
    if (!uid || !storyId || !chapterId) return;
    void queryClient.prefetchQuery(
      workspaceChapterQuery(uid, storyId, chapterId),
    );
  }, [queryClient, uid, storyId]);

  const access = workspaceAccess(identity, storyId, story);

  if (access === "checking") return <EditorWorkspaceSkeleton />;

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
