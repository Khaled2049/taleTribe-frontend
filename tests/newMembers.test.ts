import { describe, expect, it } from "vitest";
import type { PublicProfile } from "../packages/story-data-client/src/repos/ProfileRepo";
import { toNewMembers } from "../src/lib/newMembers";

const VIEWER = "viewer-uid";

const profile = (uid: string, username = uid): PublicProfile => ({
  uid,
  username,
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
  followerCount: 0,
  isWriter: false,
});

describe("toNewMembers", () => {
  it("hides people the viewer already follows", () => {
    const members = toNewMembers(
      [profile("a"), profile("b"), profile("c")],
      VIEWER,
      ["b"],
      4,
    );
    expect(members.map((m) => m.uid)).toEqual(["a", "c"]);
  });

  it("hides the viewer, who cannot follow themselves", () => {
    const members = toNewMembers(
      [profile(VIEWER), profile("a")],
      VIEWER,
      [],
      4,
    );
    expect(members.map((m) => m.uid)).toEqual(["a"]);
  });

  it("keeps the API's newest-first order", () => {
    const members = toNewMembers(
      [profile("c"), profile("a"), profile("b")],
      VIEWER,
      [],
      4,
    );
    expect(members.map((m) => m.uid)).toEqual(["c", "a", "b"]);
  });

  it("caps the list", () => {
    const members = toNewMembers(
      [profile("a"), profile("b"), profile("c"), profile("d")],
      VIEWER,
      [],
      2,
    );
    expect(members.map((m) => m.uid)).toEqual(["a", "b"]);
  });

  it("excludes nothing for a signed-out reader", () => {
    const members = toNewMembers([profile("a"), profile("b")], null, [], 4);
    expect(members.map((m) => m.uid)).toEqual(["a", "b"]);
  });

  it("returns nothing when the viewer already follows everyone", () => {
    expect(toNewMembers([profile("a")], VIEWER, ["a"], 4)).toEqual([]);
  });

  it("handles an empty directory", () => {
    expect(toNewMembers([], VIEWER, [], 4)).toEqual([]);
  });
});
