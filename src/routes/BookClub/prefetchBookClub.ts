import type { QueryClient } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/queryClient";
import { bookClubQuery } from "@/hooks/queries/useBookClubQueries";

export function preloadBookClubCode() {
  import("./BookClubDetails").catch(() => undefined);
}

/**
 * The club read is public, so it can start with the navigation rather than
 * after the sign-in check and the page chunk have both finished.
 */
export function prefetchBookClub(
  clubId: string,
  queryClient: QueryClient = appQueryClient,
) {
  preloadBookClubCode();
  return queryClient.prefetchQuery(bookClubQuery(clubId));
}
