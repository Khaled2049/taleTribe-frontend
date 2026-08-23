import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  PublicProfile,
  RecentFollower,
  profileRepo,
} from "@novelsync/story-data-client";
import { queryKeys } from "./queryKeys";

const FIVE_MINUTES = 1000 * 60 * 5;

/**
 * Username-prefix search. Deliberately a plain useQuery: the rules cap a page at
 * 30 documents and the result set is one page, so there is nothing to paginate.
 * Pass an already-debounced term — the term is part of the cache key, so every
 * distinct keystroke would otherwise become its own query and its own read.
 */
export const useUserSearch = (term: string) =>
  useQuery<PublicProfile[]>({
    queryKey: queryKeys.people.search(term.trim().toLowerCase()),
    queryFn: () => profileRepo.searchByUsernamePrefix(term),
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

  return useQuery<PublicProfile[]>({
    queryKey: queryKeys.people.following(capped),
    queryFn: async () => {
      const map = await profileRepo.getMany([...capped]);
      return capped
        .filter((uid) => map.has(uid))
        .map((uid) => map.get(uid)!)
        .sort((a, b) => a.username.localeCompare(b.username));
    },
    enabled: capped.length > 0,
    staleTime: FIVE_MINUTES,
  });
};

/** Mirrors useFollowingProfiles, batching the viewer's followers instead — backs the "Follows you" segment. */
export const useFollowerProfiles = (uids: readonly string[]) => {
  const capped = uids.slice(0, FOLLOWING_SIDEBAR_LIMIT);

  return useQuery<PublicProfile[]>({
    queryKey: queryKeys.people.followers(capped),
    queryFn: async () => {
      const map = await profileRepo.getMany([...capped]);
      return capped
        .filter((uid) => map.has(uid))
        .map((uid) => map.get(uid)!)
        .sort((a, b) => a.username.localeCompare(b.username));
    },
    enabled: capped.length > 0,
    staleTime: FIVE_MINUTES,
  });
};

type PeoplePage = { profiles: PublicProfile[]; nextCursor?: string };

/** The paginated "All members" segment — also the base "New this week" filters client-side from (it's a prefix of newest-first order). */
export const useMemberDirectory = (sort: "newest" | "az") =>
  useInfiniteQuery<
    PeoplePage,
    Error,
    { pages: PeoplePage[] },
    readonly unknown[],
    string | undefined
  >({
    queryKey: queryKeys.people.directory(sort),
    queryFn: async ({ pageParam }) =>
      profileRepo.listMembers({ sort, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: FIVE_MINUTES,
  });

/** Who recently started following you — real data, `user_follows.created_at`. */
export const useRecentFollowers = () =>
  useQuery<RecentFollower[]>({
    queryKey: queryKeys.people.recentFollowers(),
    queryFn: () => profileRepo.getRecentFollowers(),
    staleTime: FIVE_MINUTES,
  });

/**
 * "Your circle" — entirely computed from the viewer's own following/followers
 * arrays, already hydrated onto their user object. No network call: the only
 * other user whose full follow graph a client can ever read is its own.
 */
export const useMyCircle = (
  following: readonly string[],
  followers: readonly string[],
) =>
  useMemo(() => {
    const followerSet = new Set(followers);
    const mutualCount = following.filter((uid) => followerSet.has(uid)).length;
    return {
      followingCount: following.length,
      followersCount: followers.length,
      mutualCount,
    };
  }, [following, followers]);
