import { describe, expect, it } from "vitest";
import type { IClub } from "@/types/IClub";
import {
  filterClubs,
  withClubFirst,
  withMembership,
  withoutClub,
} from "@/lib/bookClubList";

const club = (id: string, overrides: Partial<IClub> = {}): IClub => ({
  id,
  name: id,
  description: "",
  image: "",
  members: [],
  category: "",
  activity: "",
  creatorId: "owner",
  ...overrides,
});

const ids = (clubs: IClub[]) => clubs.map((c) => c.id);

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

describe("withMembership", () => {
  const clubs = [club("a", { members: ["u1"] }), club("b")];

  it("adds the member to the named club only", () => {
    const next = withMembership(clubs, "b", "u2", true);
    expect(next[1].members).toEqual(["u2"]);
    expect(next[0]).toBe(clubs[0]);
  });

  it("removes the member", () => {
    expect(withMembership(clubs, "a", "u1", false)[0].members).toEqual([]);
  });

  it("leaves the club untouched when membership already matches", () => {
    expect(withMembership(clubs, "a", "u1", true)[0]).toBe(clubs[0]);
    expect(withMembership(clubs, "b", "u1", false)[1]).toBe(clubs[1]);
  });
});
