import { describe, expect, it } from "vitest";
import {
  ownershipKey,
  ownershipOutcome,
  workspaceAccess,
} from "@/lib/workspaceAccess";

const signedIn = { loading: false, uid: "u1" };

describe("workspaceAccess", () => {
  it("waits while Firebase has not reported an identity", () => {
    expect(workspaceAccess({ loading: true, uid: null }, "s1", null)).toBe(
      "checking",
    );
  });

  it("denies a resolved signed-out visitor", () => {
    expect(workspaceAccess({ loading: false, uid: null }, "s1", null)).toBe(
      "denied",
    );
  });

  it("denies a missing story id", () => {
    expect(workspaceAccess(signedIn, undefined, null)).toBe("denied");
  });

  it("keeps checking until the current uid and story have a result", () => {
    expect(workspaceAccess(signedIn, "s1", null)).toBe("checking");
  });

  it("ignores a result for a previous story", () => {
    const check = { key: ownershipKey("u1", "s0"), outcome: "owner" as const };
    expect(workspaceAccess(signedIn, "s1", check)).toBe("checking");
  });

  it("ignores a result for a previous account", () => {
    const check = { key: ownershipKey("u0", "s1"), outcome: "owner" as const };
    expect(workspaceAccess(signedIn, "s1", check)).toBe("checking");
  });

  it.each(["owner", "denied", "error"] as const)(
    "returns the %s outcome for the current uid and story",
    (outcome) => {
      const check = { key: ownershipKey("u1", "s1"), outcome };
      expect(workspaceAccess(signedIn, "s1", check)).toBe(outcome);
    },
  );
});

describe("ownershipOutcome", () => {
  it("grants the owner", () => {
    expect(ownershipOutcome({ userId: "u1" }, "u1")).toBe("owner");
  });

  it("denies a readable story owned by someone else", () => {
    expect(ownershipOutcome({ userId: "u2" }, "u1")).toBe("denied");
  });

  it("denies a missing story", () => {
    expect(ownershipOutcome(null, "u1")).toBe("denied");
  });
});
