import type { QueryClient } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/queryClient";
import {
  guestbookEntriesQuery,
  wallFeedQuery,
} from "@/hooks/queries/useGuestbookQueries";
import { publicProfileQuery } from "@/hooks/queries/useUserQueries";

/** Start the route chunk and its first read together, keyed to the Firebase uid. */
export function prefetchGuestbookRoute(
  path: string,
  viewerId: string | null,
  client: QueryClient = appQueryClient,
) {
  if (path === "/" || path === "/guestbook") {
    if (!viewerId) return Promise.resolve();
    void import("./WallPage").catch(() => undefined);
    return client.prefetchInfiniteQuery(wallFeedQuery(viewerId, "all"));
  }

  const ownerId = /^\/guestbook\/([^/]+)\/?$/.exec(path)?.[1];
  if (!ownerId || ownerId === "people" || ownerId === "settings") {
    return Promise.resolve();
  }
  void import("./GuestbookPage").catch(() => undefined);
  if (ownerId === viewerId) {
    return client.prefetchInfiniteQuery(wallFeedQuery(viewerId, "all"));
  }
  return Promise.all([
    client.prefetchQuery(publicProfileQuery(ownerId)),
    client.prefetchInfiniteQuery(guestbookEntriesQuery(ownerId, viewerId)),
  ]).then(() => undefined);
}
