import React, { useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { PublicProfile } from "@novelsync/story-data-client";
import { SearchField } from "@/components/common";
import { SEOHead } from "@/components/seo/SEOHead";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useUserSearch,
  useMemberDirectory,
  useFollowingProfiles,
  useFollowerProfiles,
  useRecentFollowers,
  useMyCircle,
} from "@/hooks/queries/usePeopleQueries";
import { useAuthContext } from "@/contexts/AuthContext";
import MemberCard from "./MemberCard";
import PeopleSegments, {
  GROUP_LABELS,
  PeopleSegment,
  PeopleSort,
} from "./PeopleSegments";
import YourCircle from "./YourCircle";
import RecentFollowers from "./RecentFollowers";
import GuestbookTabs from "./GuestbookTabs";
import FollowingSidebar, { FollowingStrip } from "./FollowingSidebar";

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const isNew = (p: PublicProfile) =>
  Date.now() - new Date(p.createdAt).getTime() < NEW_THRESHOLD_MS;

const sortNewest = (a: PublicProfile, b: PublicProfile) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
const sortAZ = (a: PublicProfile, b: PublicProfile) =>
  a.username.localeCompare(b.username);

const PeopleDirectory: React.FC = () => {
  const { user } = useAuthContext();
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, 250);
  const [segment, setSegment] = useState<PeopleSegment>("all");
  const [sort, setSort] = useState<PeopleSort>("newest");

  const searching = debouncedTerm.trim().length > 0;
  const search = useUserSearch(debouncedTerm);

  // "New this week" always browses the newest-first order regardless of the
  // sort control — that's what lets the 7-day window be found at all; the
  // sort control only reorders the resulting subset.
  const directorySort = segment === "new" ? "newest" : sort;
  const directory = useMemberDirectory(directorySort);
  const following = useFollowingProfiles(user?.following ?? []);
  const followers = useFollowerProfiles(user?.followers ?? []);
  const recentFollowers = useRecentFollowers();
  const circle = useMyCircle(user?.following ?? [], user?.followers ?? []);

  const resortLocal = (list: PublicProfile[]) =>
    sort === "az" ? [...list].sort(sortAZ) : [...list].sort(sortNewest);

  const {
    people,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMemo(() => {
    if (searching) {
      return {
        people: search.data ?? [],
        isLoading: search.isLoading || term.trim() !== debouncedTerm.trim(),
        isError: search.isError,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: undefined,
      };
    }
    switch (segment) {
      case "following":
        return {
          people: resortLocal(following.data ?? []),
          isLoading: following.isLoading,
          isError: following.isError,
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: undefined,
        };
      case "followers":
        return {
          people: resortLocal(followers.data ?? []),
          isLoading: followers.isLoading,
          isError: followers.isError,
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: undefined,
        };
      case "new": {
        const all = directory.data?.pages.flatMap((p) => p.profiles) ?? [];
        const fresh = all.filter(isNew);
        return {
          people: sort === "az" ? [...fresh].sort(sortAZ) : fresh,
          isLoading: directory.isLoading,
          isError: directory.isError,
          hasNextPage: directory.hasNextPage,
          isFetchingNextPage: directory.isFetchingNextPage,
          fetchNextPage: directory.fetchNextPage,
        };
      }
      default:
        return {
          people: directory.data?.pages.flatMap((p) => p.profiles) ?? [],
          isLoading: directory.isLoading,
          isError: directory.isError,
          hasNextPage: directory.hasNextPage,
          isFetchingNextPage: directory.isFetchingNextPage,
          fetchNextPage: directory.fetchNextPage,
        };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searching,
    segment,
    sort,
    search.data,
    search.isLoading,
    search.isError,
    following.data,
    following.isLoading,
    following.isError,
    followers.data,
    followers.isLoading,
    followers.isError,
    directory.data,
    directory.isLoading,
    directory.isError,
    directory.hasNextPage,
    directory.isFetchingNextPage,
    directory.fetchNextPage,
    term,
    debouncedTerm,
  ]);

  // Exclude yourself: you cannot follow yourself and your own profile is a
  // click away in the navbar.
  const visible = people.filter((p) => p.uid !== user?.uid);

  const groupLabel = searching
    ? `Results for "${debouncedTerm.trim()}"`
    : GROUP_LABELS[segment];

  if (!user) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="text-center">
          <Users className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
          <p className="font-heading text-title font-light text-ns-ink-muted mb-1">
            Sign in to find people
          </p>
          <p className="font-ui text-sm text-ns-ink-muted">
            The member directory is only visible to signed-in members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title="People" noindex />
      <div className="max-w-[1320px] mx-auto px-4 sm:px-10 py-8 sm:py-9">
        <header className="mb-6">
          <h1 className="font-heading text-3xl sm:text-[44px] text-ns-ink leading-none tracking-[-0.015em]">
            People
          </h1>
          <div className="mt-3.5">
            <GuestbookTabs active="people" />
          </div>
        </header>

        <FollowingStrip following={user.following ?? []} />

        <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_268px] gap-8 lg:gap-10 items-start">
          <div className="hidden lg:block lg:sticky lg:top-6">
            <FollowingSidebar following={user.following ?? []} />
          </div>

          <div className="min-w-0 flex flex-col gap-[22px]">
            <SearchField
              value={term}
              onChange={setTerm}
              placeholder="Search members, or a story they wrote…"
              ariaLabel="Search people by username"
            />

            {!searching && (
              <PeopleSegments
                segment={segment}
                onSegmentChange={setSegment}
                sort={sort}
                onSortChange={setSort}
              />
            )}

            <div className="flex items-center gap-3.5">
              <span className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-ns-ink-muted whitespace-nowrap">
                {groupLabel}
              </span>
              <span className="flex-1 h-px bg-ns-border" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-ns-accent" size={28} />
              </div>
            ) : isError ? (
              <p className="py-16 text-center font-ui text-sm text-ns-destructive">
                Could not load members. Please refresh and try again.
              </p>
            ) : visible.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
                <p className="font-heading text-title font-light text-ns-ink-muted mb-1">
                  {searching ? "No one by that name" : "No members to show yet"}
                </p>
                {searching && (
                  <p className="font-ui text-sm text-ns-ink-muted">
                    Usernames match from the start, so try the first few
                    letters.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {visible.map((person) => (
                  <MemberCard
                    key={person.uid}
                    member={person}
                    viewerFollowers={user.followers ?? []}
                  />
                ))}

                {hasNextPage && (
                  <div className="text-center pt-5 pb-1">
                    <button
                      type="button"
                      onClick={() => fetchNextPage?.()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-2 font-ui text-[13.5px] font-bold text-ns-accent border border-ns-border bg-ns-elevated rounded-full px-6 py-2.5 hover:border-ns-border-strong transition-colors disabled:opacity-50"
                    >
                      {isFetchingNextPage && (
                        <Loader2 className="animate-spin" size={14} />
                      )}
                      Show more members
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hidden lg:flex lg:sticky lg:top-6 flex-col gap-5">
            <YourCircle
              followingCount={circle.followingCount}
              followersCount={circle.followersCount}
              mutualCount={circle.mutualCount}
            />
            <RecentFollowers followers={recentFollowers.data ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeopleDirectory;
