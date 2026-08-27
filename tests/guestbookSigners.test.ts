import { describe, expect, it } from "vitest";
import type { IGuestbookEntry } from "../packages/story-data-client/src/types/IGuestbookEntry";
import { toSigners } from "../src/lib/guestbookSigners";

const OWNER = "owner-uid";
const VIEWER = "viewer-uid";

let seq = 0;

const entry = (
  authorId: string,
  authorUsername: string,
  createdAt: Date = new Date(Date.now() - seq * 1000),
): IGuestbookEntry => ({
  id: `entry-${seq++}`,
  ownerId: OWNER,
  content: "hi",
  createdAt,
  authorId,
  authorUsername,
  commentCount: 0,
  upvoteCount: 0,
  downvoteCount: 0,
});

describe("toSigners", () => {
  it("collapses repeat signers into one row and counts their posts", () => {
    const signers = toSigners(
      [entry("a", "ana"), entry("b", "bo"), entry("a", "ana")],
      new Set([OWNER]),
    );
    expect(signers.map((s) => s.id)).toEqual(["a", "b"]);
    expect(signers[0].posts).toBe(2);
    expect(signers[1].posts).toBe(1);
  });

  it("keeps the newest post as a signer's timestamp", () => {
    const newest = new Date("2026-08-26T12:00:00Z");
    const older = new Date("2026-01-01T00:00:00Z");
    // Entries arrive newest-first, so the first sighting is the latest post.
    const [signer] = toSigners(
      [entry("a", "ana", newest), entry("a", "ana", older)],
      new Set([OWNER]),
    );
    expect(signer.latest).toBe(newest);
  });

  it("preserves newest-first order rather than sorting by post count", () => {
    const signers = toSigners(
      [entry("a", "ana"), entry("b", "bo"), entry("b", "bo"), entry("b", "bo")],
      new Set([OWNER]),
    );
    expect(signers.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("excludes the owner — you are already on their page", () => {
    const signers = toSigners(
      [entry(OWNER, "owner"), entry("a", "ana")],
      new Set([OWNER]),
    );
    expect(signers.map((s) => s.id)).toEqual(["a"]);
  });

  it("excludes the viewer, who cannot follow themselves", () => {
    const signers = toSigners(
      [entry(VIEWER, "me"), entry("a", "ana")],
      new Set([OWNER, VIEWER]),
    );
    expect(signers.map((s) => s.id)).toEqual(["a"]);
  });

  it("skips entries with no author id", () => {
    const signers = toSigners(
      [entry("", "ghost"), entry("a", "ana")],
      new Set([OWNER]),
    );
    expect(signers.map((s) => s.id)).toEqual(["a"]);
  });

  it("returns nothing when the owner is the only signer", () => {
    expect(toSigners([entry(OWNER, "owner")], new Set([OWNER]))).toEqual([]);
  });

  it("handles an empty guestbook", () => {
    expect(toSigners([], new Set([OWNER]))).toEqual([]);
  });
});
