import { describe, expect, it } from "vitest";
import type { IClub, IClubSummary } from "@/types/IClub";
import {
  clubListView,
  filterClubs,
  isJoined,
  toClubSummary,
  withClubFirst,
  withMemberCountChange,
  withMembership,
  withoutClub,
} from "@/lib/bookClubList";

const club = (
  id: string,
  overrides: Partial<IClubSummary> = {},
): IClubSummary => ({
  id,
  name: id,
  description: "",
  image: "",
  category: "",
  activity: "",
  creatorId: "owner",
  memberCount: 1,
  ...overrides,
});

const ids = (clubs: IClubSummary[]) => clubs.map((c) => c.id);

describe("toClubSummary", () => {
  const full: IClub = {
    id: "c1",
    name: "Club",
    description: "d",
    image: "",
    members: ["owner", "u1", "u2"],
    category: "Mystery",
    activity: "Weekly",
    creatorId: "owner",
    meetUp: "Thursdays",
    discussionPrompts: [],
    polls: [],
  };

  it("counts the members of a full club and drops everything nested", () => {
    expect(toClubSummary(full)).toEqual({
      id: "c1",
      name: "Club",
      description: "d",
      image: "",
      category: "Mystery",
      activity: "Weekly",
      creatorId: "owner",
      memberCount: 3,
      meetUp: "Thursdays",
    });
  });

  it("keeps the count a summary row already carries", () => {
    expect(toClubSummary(club("a", { memberCount: 7 })).memberCount).toBe(7);
  });

  it("omits an empty meetup rather than carrying a blank", () => {
    expect("meetUp" in toClubSummary({ ...full, meetUp: "" })).toBe(false);
  });
});

describe("filterClubs", () => {
  const clubs = [
    club("a", { name: "Glass Cartographers" }),
    club("b", { description: "slow readers of long books" }),
    club("c", { category: "Mystery" }),
  ];

  it("returns every club for a blank search", () => {
    expect(ids(filterClubs(clubs, "   "))).toEqual(["a", "b", "c"]);
  });

  it("matches name, description and category without regard to case", () => {
    expect(ids(filterClubs(clubs, "GLASS"))).toEqual(["a"]);
    expect(ids(filterClubs(clubs, "long books"))).toEqual(["b"]);
    expect(ids(filterClubs(clubs, " mystery "))).toEqual(["c"]);
  });

  it("returns nothing when no field matches", () => {
    expect(filterClubs(clubs, "zzz")).toEqual([]);
  });
});

describe("clubListView", () => {
  it("is loading until the first answer arrives", () => {
    expect(clubListView({ data: undefined, isError: false }, 0, "")).toBe(
      "loading",
    );
  });

  it("reports a failed first load as an error, not an empty list", () => {
    expect(clubListView({ data: undefined, isError: true }, 0, "")).toBe(
      "error",
    );
  });

  it("keeps showing held rows when a refresh fails", () => {
    expect(clubListView({ data: [club("a")], isError: true }, 1, "")).toBe(
      "rows",
    );
  });

  it("is empty only when the server returned no clubs", () => {
    expect(clubListView({ data: [], isError: false }, 0, "  ")).toBe("empty");
  });

  it("distinguishes a search with no matches from an empty list", () => {
    expect(clubListView({ data: [club("a")], isError: false }, 0, "zzz")).toBe(
      "no-matches",
    );
  });
});

describe("withClubFirst", () => {
  const clubs = [club("a"), club("b"), club("c")];

  it("puts a new club at the head", () => {
    expect(ids(withClubFirst(clubs, club("d")))).toEqual(["d", "a", "b", "c"]);
  });

  it("replaces an edited club and moves it to the head", () => {
    const next = withClubFirst(clubs, club("b", { name: "renamed" }));
    expect(ids(next)).toEqual(["b", "a", "c"]);
    expect(next[0].name).toBe("renamed");
  });
});

describe("withoutClub", () => {
  it("drops only the named club", () => {
    expect(ids(withoutClub([club("a"), club("b")], "a"))).toEqual(["b"]);
  });
});

describe("withMemberCountChange", () => {
  const clubs = [club("a", { memberCount: 2 }), club("b", { memberCount: 0 })];

  it("changes the named club's count only", () => {
    const next = withMemberCountChange(clubs, "a", 1);
    expect(next[0].memberCount).toBe(3);
    expect(next[1]).toBe(clubs[1]);
  });

  it("does not go below zero", () => {
    expect(withMemberCountChange(clubs, "b", -1)[1].memberCount).toBe(0);
  });
});

describe("withMembership", () => {
  it("adds a club the viewer joined", () => {
    expect(withMembership(["a"], "b", true)).toEqual(["a", "b"]);
  });

  it("does not list a club twice", () => {
    expect(withMembership(["a", "b"], "a", true)).toEqual(["b", "a"]);
  });

  it("removes a club the viewer left", () => {
    expect(withMembership(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("isJoined", () => {
  it("is false for a signed-out visitor without waiting for anything", () => {
    expect(isJoined(null, undefined, "a")).toBe(false);
  });

  it("is unknown while a signed-in viewer's clubs are loading", () => {
    expect(isJoined("u1", undefined, "a")).toBeUndefined();
  });

  it("answers from the viewer's club ids once they arrive", () => {
    expect(isJoined("u1", ["a"], "a")).toBe(true);
    expect(isJoined("u1", ["a"], "b")).toBe(false);
  });
});
