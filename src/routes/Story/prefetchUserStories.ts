import { appQueryClient } from "@/lib/queryClient";
import { ownerStoriesQuery } from "@/hooks/queries/ownerStories";

export function prefetchUserStories(uid: string | null) {
  if (!uid) return;
  import("./UserStories").catch(() => undefined);
  void appQueryClient.prefetchQuery(ownerStoriesQuery(uid));
}
