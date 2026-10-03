import type { IClub } from "@/types/IClub";

type ClubList = readonly IClub[];

export function filterClubs(clubs: ClubList, search: string): IClub[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...clubs];
  return clubs.filter((club) =>
    [club.name, club.description, club.category].some((field) =>
      field?.toLowerCase().includes(q),
    ),
  );
}

// The list is served most-recently-updated first, so a created or edited club
// belongs at the head; anywhere else and the next refetch reorders the page.
export function withClubFirst(clubs: ClubList, club: IClub): IClub[] {
  return [club, ...clubs.filter((c) => c.id !== club.id)];
}

export function withoutClub(clubs: ClubList, clubId: string): IClub[] {
  return clubs.filter((c) => c.id !== clubId);
}

export function withMembership(
  clubs: ClubList,
  clubId: string,
  uid: string,
  joined: boolean,
): IClub[] {
  return clubs.map((club) => {
    if (club.id !== clubId || club.members.includes(uid) === joined) {
      return club;
    }
    return {
      ...club,
      members: joined
        ? [...club.members, uid]
        : club.members.filter((id) => id !== uid),
    };
  });
}
