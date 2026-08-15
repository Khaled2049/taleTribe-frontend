import { useQuery } from "@tanstack/react-query";
import {
  PublicProfileWithId,
  publicProfileService,
} from "@/services/PublicProfileService";
import { queryKeys } from "./queryKeys";

const FIVE_MINUTES = 1000 * 60 * 5;

/**
 * Username-prefix search. Deliberately a plain useQuery: the rules cap a page at
 * 30 documents and the result set is one page, so there is nothing to paginate.
 * Pass an already-debounced term — the term is part of the cache key, so every
 * distinct keystroke would otherwise become its own query and its own read.
 */
export const useUserSearch = (term: string) =>
  useQuery<PublicProfileWithId[]>({
    queryKey: queryKeys.people.search(term.trim().toLowerCase()),
    queryFn: () => publicProfileService.searchByUsernamePrefix(term),
    enabled: term.trim().length > 0,
    staleTime: FIVE_MINUTES,
  });

/**
 * Profiles for the people you follow.
 *
 * `getPublicProfiles` issues one read per uid — there is no batched `in` query
 * here because the profiles are keyed by uid, not queried by field — so the list
 * is capped rather than unbounded. Someone following more than the cap sees the
 * first page; the directory is the place to find the rest.
 */
export const FOLLOWING_SIDEBAR_LIMIT = 50;

export const useFollowingProfiles = (uids: readonly string[]) => {
  const capped = uids.slice(0, FOLLOWING_SIDEBAR_LIMIT);

  return useQuery<PublicProfileWithId[]>({
    queryKey: queryKeys.people.following(capped),
    queryFn: async () => {
      const map = await publicProfileService.getPublicProfiles([...capped]);
      return capped
        .filter((uid) => map.has(uid))
        .map((uid) => ({ ...map.get(uid)!, uid }))
        .sort((a, b) => a.username.localeCompare(b.username));
    },
    enabled: capped.length > 0,
    staleTime: FIVE_MINUTES,
  });
};

/** The directory's resting state, shown before anything is typed. */
export const useRecentMembers = () =>
  useQuery<PublicProfileWithId[]>({
    queryKey: queryKeys.people.recent(),
    queryFn: () => publicProfileService.listRecent(),
    staleTime: FIVE_MINUTES,
  });
