/**
 * The client-side wall gate.
 *
 * This matrix is a deliberate duplicate of the one in
 * tests/rules/wallPolicy.rules.test.ts. The rules are the authority; this decides
 * only whether a compose form is rendered. A disagreement between them is either
 * a form that always errors on submit or a form hidden for no reason, so the two
 * tables are written out identically on purpose — if you change one, the other
 * must fail.
 */
import { describe, expect, it } from "vitest";
import {
  GuestbookPolicy,
  canPostOnWall,
  normalizePolicy,
  wallClosedReason,
} from "../src/lib/guestbookPolicy";

const OWNER = "user_owner";
const FOLLOWER = "user_follower";
const FOLLOWED = "user_followed";
const MUTUAL = "user_mutual";
const STRANGER = "user_stranger";

/**
 * Each viewer's own arrays, mirroring the owner's `followers: [FOLLOWER, MUTUAL]`
 * and `following: [FOLLOWED, MUTUAL]`. The viewer sees the relationship from the
 * other side: a follower of the owner has the owner in their own `following`.
 */
const VIEWERS: Record<string, { following: string[]; followers: string[] }> = {
  [OWNER]: { following: [], followers: [] },
  [FOLLOWER]: { following: [OWNER], followers: [] },
  [FOLLOWED]: { following: [], followers: [OWNER] },
  [MUTUAL]: { following: [OWNER], followers: [OWNER] },
  [STRANGER]: { following: [], followers: [] },
};

const MATRIX: Record<GuestbookPolicy, Record<string, boolean>> = {
  everyone: {
    [OWNER]: true,
    [FOLLOWER]: true,
    [FOLLOWED]: true,
    [MUTUAL]: true,
    [STRANGER]: true,
  },
  followers: {
    [OWNER]: true,
    [FOLLOWER]: true,
    [FOLLOWED]: false,
    [MUTUAL]: true,
    [STRANGER]: false,
  },
  following: {
    [OWNER]: true,
    [FOLLOWER]: false,
    [FOLLOWED]: true,
    [MUTUAL]: true,
    [STRANGER]: false,
  },
  mutuals: {
    [OWNER]: true,
    [FOLLOWER]: false,
    [FOLLOWED]: false,
    [MUTUAL]: true,
    [STRANGER]: false,
  },
  nobody: {
    [OWNER]: true,
    [FOLLOWER]: false,
    [FOLLOWED]: false,
    [MUTUAL]: false,
    [STRANGER]: false,
  },
};

const check = (policy: unknown, viewerId: string) =>
  canPostOnWall({
    policy,
    ownerId: OWNER,
    viewerId,
    viewerFollowing: VIEWERS[viewerId].following,
    viewerFollowers: VIEWERS[viewerId].followers,
  });

describe("canPostOnWall", () => {
  (Object.keys(MATRIX) as GuestbookPolicy[]).forEach((policy) => {
    Object.entries(MATRIX[policy]).forEach(([viewerId, expected]) => {
      it(`${policy}: ${viewerId} -> ${expected}`, () => {
        expect(check(policy, viewerId)).toBe(expected);
      });
    });
  });

  it("denies a signed-out viewer regardless of policy", () => {
    (Object.keys(MATRIX) as GuestbookPolicy[]).forEach((policy) => {
      expect(
        canPostOnWall({
          policy,
          ownerId: OWNER,
          viewerId: null,
          viewerFollowing: [],
          viewerFollowers: [],
        }),
      ).toBe(false);
    });
  });

  // The rules default the same way, so an account that predates the setting
  // keeps the open wall it already had.
  it("treats an absent policy as everyone", () => {
    expect(check(undefined, STRANGER)).toBe(true);
    expect(check(null, STRANGER)).toBe(true);
  });

  // Diverges from the rules by design: an unrecognised value reads as 'everyone'
  // here but matches no branch there, so the form shows and the write fails.
  // Preferred over hiding the form on a value we simply do not understand.
  it("treats an unrecognised policy as everyone", () => {
    expect(check("banana", STRANGER)).toBe(true);
  });

  it("always lets the owner post on their own wall", () => {
    (Object.keys(MATRIX) as GuestbookPolicy[]).forEach((policy) => {
      expect(check(policy, OWNER)).toBe(true);
    });
  });
});

describe("normalizePolicy", () => {
  it("passes through every valid value", () => {
    (Object.keys(MATRIX) as GuestbookPolicy[]).forEach((policy) => {
      expect(normalizePolicy(policy)).toBe(policy);
    });
  });

  it("falls back to everyone for anything else", () => {
    [undefined, null, "", "banana", 3, {}, []].forEach((value) => {
      expect(normalizePolicy(value)).toBe("everyone");
    });
  });
});

describe("wallClosedReason", () => {
  it("names the user in every case", () => {
    (Object.keys(MATRIX) as GuestbookPolicy[]).forEach((policy) => {
      expect(wallClosedReason(policy, "alice")).toContain("@alice");
    });
  });
});
