import { describe, expect, it } from "vitest";
import { ownershipOutcome, workspaceAccess } from "@/lib/workspaceAccess";

const signedIn = { loading: false, uid: "u1" };
const idle = {
  status: "pending",
  fetchStatus: "idle",
  data: undefined,
} as const;
const fetching = { ...idle, fetchStatus: "fetching" } as const;

describe("workspaceAccess", () => {
  it("waits while Firebase has not reported an identity", () => {
    expect(workspaceAccess({ loading: true, uid: null }, "s1", idle)).toBe(
      "checking",
    );
  });

  it("denies a resolved signed-out visitor", () => {
    expect(workspaceAccess({ loading: false, uid: null }, "s1", idle)).toBe(
      "denied",
    );
  });

  it("denies a missing story id", () => {
    expect(workspaceAccess(signedIn, undefined, idle)).toBe("denied");
  });

  it("keeps checking while the story is loading", () => {
    expect(workspaceAccess(signedIn, "s1", fetching)).toBe("checking");
  });

  it("grants the owner", () => {
    expect(
      workspaceAccess(signedIn, "s1", {
        status: "success",
        fetchStatus: "idle",
        data: { userId: "u1" },
      }),
    ).toBe("owner");
  });

  it("denies a missing story", () => {
    expect(
      workspaceAccess(signedIn, "s1", {
        status: "success",
        fetchStatus: "idle",
        data: null,
      }),
    ).toBe("denied");
  });

  it("reports a failed read", () => {
    expect(
      workspaceAccess(signedIn, "s1", {
        status: "error",
        fetchStatus: "idle",
        data: undefined,
      }),
    ).toBe("error");
  });

  it("checks again while a failed read is retried", () => {
    expect(
      workspaceAccess(signedIn, "s1", {
        status: "error",
        fetchStatus: "fetching",
        data: undefined,
      }),
    ).toBe("checking");
  });

  it("keeps the owner authorized when a background refetch fails", () => {
    expect(
      workspaceAccess(signedIn, "s1", {
        status: "error",
        fetchStatus: "idle",
        data: { userId: "u1" },
      }),
    ).toBe("owner");
  });
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
