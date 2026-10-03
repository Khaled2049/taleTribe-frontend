import type { IClub, IClubSummary } from "@/types/IClub";

type ClubList = readonly IClubSummary[];

/**
 * Reduces a full club to its list row. Create and edit answer with the full
 * club, and a story-data that predates `?view=summary` ignores the parameter
 * and lists full clubs too, so either shape may arrive here.
 */
export function toClubSummary(club: IClub | IClubSummary): IClubSummary {
  const memberCount =
    "memberCount" in club ? club.memberCount : club.members.length;
  return {
    id: club.id,
    name: club.name,
    description: club.description,
    image: club.image,
    category: club.category,
    activity: club.activity,
    creatorId: club.creatorId,
    memberCount,
    ...(club.meetUp ? { meetUp: club.meetUp } : {}),
  };
}

export function filterClubs(clubs: ClubList, search: string): IClubSummary[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...clubs];
  return clubs.filter((club) =>
    [club.name, club.description, club.category].some((field) =>
      field?.toLowerCase().includes(q),
    ),
  );
}

export type ClubListView =
  "loading" | "error" | "rows" | "no-matches" | "empty";

/**
 * "empty" invites the reader to found the first club, so it must mean the
 * server answered with none — never that the answer has not arrived or failed.
 * A failed background refresh keeps showing the rows already held.
 */
export function clubListView(
  query: { data: ClubList | undefined; isError: boolean },
  shownCount: number,
  search: string,
): ClubListView {
  if (query.data === undefined) return query.isError ? "error" : "loading";
  if (shownCount > 0) return "rows";
  return search.trim() ? "no-matches" : "empty";
}

// The list is served most-recently-updated first, so a created or edited club
// belongs at the head; anywhere else and the next refetch reorders the page.
export function withClubFirst(
  clubs: ClubList,
  club: IClubSummary,
): IClubSummary[] {
  return [club, ...clubs.filter((c) => c.id !== club.id)];
}

export function withoutClub(clubs: ClubList, clubId: string): IClubSummary[] {
  return clubs.filter((c) => c.id !== clubId);
}

export function withMemberCountChange(
  clubs: ClubList,
  clubId: string,
  delta: 1 | -1,
): IClubSummary[] {
  return clubs.map((club) =>
    club.id === clubId
      ? { ...club, memberCount: Math.max(0, club.memberCount + delta) }
      : club,
  );
}

/** The viewer's club ids after joining or leaving one. */
export function withMembership(
  clubIds: readonly string[],
  clubId: string,
  joined: boolean,
): string[] {
  const rest = clubIds.filter((id) => id !== clubId);
  return joined ? [...rest, clubId] : rest;
}

/**
 * `undefined` means not known yet: the viewer is signed in but their club ids
 * have not arrived, so the row must not claim "Join" and then correct itself.
 */
export function isJoined(
  uid: string | null,
  myClubIds: readonly string[] | undefined,
  clubId: string,
): boolean | undefined {
  if (!uid) return false;
  return myClubIds?.includes(clubId);
}
