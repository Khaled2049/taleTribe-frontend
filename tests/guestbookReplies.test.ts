import { describe, expect, it } from "vitest";
import type { IGuestbookReply } from "@novelsync/story-data-client";
import {
  addReply,
  guestbookRepliesKey,
  removeReplySubtree,
  replaceReply,
  toggleReplyUpvote,
} from "@/lib/guestbookReplies";

const reply = (overrides: Partial<IGuestbookReply> = {}): IGuestbookReply => ({
  id: "a",
  entryId: "post",
  content: "hi",
  authorId: "me",
  authorUsername: "Me",
  parentId: null,
  createdAt: new Date("2026-10-03T12:00:00Z"),
  updatedAt: new Date("2026-10-03T12:00:00Z"),
  upvoteCount: 0,
  downvoteCount: 0,
  userVote: null,
  ...overrides,
});
const ids = (rows: IGuestbookReply[]) => rows.map((row) => row.id);

describe("guestbook reply thread helpers", () => {
  it("scopes a thread to its viewer and stays clear of the feed key shapes", () => {
    const key = guestbookRepliesKey("owner", "post", "me");
    expect(key).not.toEqual(guestbookRepliesKey("owner", "post", null));
    expect(key).not.toEqual(guestbookRepliesKey("owner", "other", "me"));
    expect([3, 4]).not.toContain(key.length);
  });

  it("puts a new reply first and ignores one already present", () => {
    const rows = [reply()];
    expect(ids(addReply(rows, reply({ id: "b" })))).toEqual(["b", "a"]);
    expect(addReply(rows, reply())).toBe(rows);
  });

  it("replaces an edited reply in place", () => {
    const rows = [reply({ id: "b" }), reply()];
    const next = replaceReply(rows, reply({ content: "edited" }));
    expect(next.map((row) => row.content)).toEqual(["hi", "edited"]);
  });

  it("removes a whole subtree whichever order the rows arrive in", () => {
    const rows = [
      reply({ id: "leaf", parentId: "mid" }),
      reply({ id: "sibling" }),
      reply({ id: "mid", parentId: "a" }),
      reply(),
      reply({ id: "late", parentId: "leaf" }),
    ];
    expect(ids(removeReplySubtree(rows, "a"))).toEqual(["sibling"]);
    expect(ids(removeReplySubtree(rows, "mid"))).toEqual(["sibling", "a"]);
    expect(removeReplySubtree(rows, "missing")).toHaveLength(5);
  });

  it("toggles an upvote, clearing a previous downvote", () => {
    expect(toggleReplyUpvote(reply({ upvoteCount: 2 }))).toMatchObject({
      userVote: "up",
      upvoteCount: 3,
    });
    expect(
      toggleReplyUpvote(reply({ userVote: "up", upvoteCount: 1 })),
    ).toMatchObject({ userVote: null, upvoteCount: 0 });
    expect(
      toggleReplyUpvote(reply({ userVote: "down", downvoteCount: 1 })),
    ).toMatchObject({ userVote: "up", upvoteCount: 1, downvoteCount: 0 });
  });
});
