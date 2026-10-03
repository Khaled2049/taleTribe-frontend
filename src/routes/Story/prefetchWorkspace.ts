import { appQueryClient } from "@/lib/queryClient";
import { prefetchWorkspaceData } from "@/hooks/queries/workspaceStory";

/**
 * Both chunks at once: rendered normally, CreateStory only starts loading
 * after PrivateRoute has loaded and the ownership check has passed.
 */
export function preloadEditorCode() {
  import("../PrivateRoute").catch(() => undefined);
  import("./CreateStory").catch(() => undefined);
}

export function prefetchWorkspace(
  uid: string | null,
  storyId: string,
  chapterId?: string | null,
) {
  preloadEditorCode();
  if (uid) void prefetchWorkspaceData(appQueryClient, uid, storyId, chapterId);
}
