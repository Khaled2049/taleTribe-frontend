import { describe, expect, it } from "vitest";
import {
  StoryDataError,
  type IGuestbookReply,
} from "@novelsync/story-data-client";
import {
  addReply,
  appendReplyPage,
  isWallClosedError,
  replyErrorMessage,
  type ReplyThread,
  guestbookRepliesKey,
  indexReplies,
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
const loaded = (
  rows: IGuestbookReply[],
  extra: Partial<ReplyThread> = {},
): ReplyThread => ({ replies: rows, totalCount: rows.length, ...extra });

describe("guestbook reply thread helpers", () => {
  it("scopes a thread to its viewer and stays clear of the feed key shapes", () => {
    const key = guestbookRepliesKey("owner", "post", "me");
    expect(key).not.toEqual(guestbookRepliesKey("owner", "post", null));
    expect(key).not.toEqual(guestbookRepliesKey("owner", "other", "me"));
    expect([3, 4]).not.toContain(key.length);
  });

  it("puts a new reply first, counts it, and ignores one already present", () => {
    const thread = loaded([reply()], { totalCount: 7, nextCursor: "older" });
    const next = addReply(thread, reply({ id: "b" }));
    expect(ids(next.replies)).toEqual(["b", "a"]);
    expect(next).toMatchObject({ totalCount: 8, nextCursor: "older" });
    expect(addReply(thread, reply())).toBe(thread);
  });

  it("replaces an edited reply in place without recounting", () => {
    const thread = loaded([reply({ id: "b" }), reply()], { totalCount: 9 });
    const next = replaceReply(thread, reply({ content: "edited" }));
    expect(next.replies.map((row) => row.content)).toEqual(["hi", "edited"]);
    expect(next.totalCount).toBe(9);
  });

  it("removes a whole subtree whichever order the rows arrive in", () => {
    const thread = loaded(
      [
        reply({ id: "leaf", parentId: "mid" }),
        reply({ id: "sibling" }),
        reply({ id: "mid", parentId: "a" }),
        reply(),
        reply({ id: "late", parentId: "leaf" }),
      ],
      { totalCount: 12 },
    );
    const withoutA = removeReplySubtree(thread, "a");
    expect(ids(withoutA.replies)).toEqual(["sibling"]);
    // Four left the loaded page; the seven on unloaded pages still count.
    expect(withoutA.totalCount).toBe(8);
    expect(ids(removeReplySubtree(thread, "mid").replies)).toEqual([
      "sibling",
      "a",
    ]);
    expect(removeReplySubtree(thread, "missing")).toMatchObject({
      totalCount: 12,
    });
  });

  it("appends an older page after the loaded threads, without duplicates", () => {
    const thread = loaded([reply({ id: "new" }), reply()], {
      totalCount: 5,
      nextCursor: "c1",
    });
    const next = appendReplyPage(thread, {
      replies: [reply(), reply({ id: "old" })],
      totalCount: 6,
    });
    expect(ids(next.replies)).toEqual(["new", "a", "old"]);
    expect(next.totalCount).toBe(6);
    expect(next.nextCursor).toBeUndefined();
  });

  it("explains a refused or rate-limited reply, and nothing else", () => {
    const closed = new StoryDataError(403, "forbidden");
    expect(isWallClosedError(closed)).toBe(true);
    expect(isWallClosedError(new StoryDataError(500, "boom"))).toBe(false);
    expect(replyErrorMessage(closed, "fallback")).toMatch(/isn't accepting/);
    expect(
      replyErrorMessage(new StoryDataError(429, "rate limit exceeded"), "x"),
    ).toMatch(/limit/);
    expect(replyErrorMessage(new Error("offline"), "fallback")).toBe(
      "fallback",
    );
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

  it("indexes a thread once, keeping the server's order within each level", () => {
    const { roots, childrenOf } = indexReplies([
      reply({ id: "c2", parentId: "a" }),
      reply({ id: "b" }),
      reply({ id: "g", parentId: "c1" }),
      reply({ id: "c1", parentId: "a" }),
      reply(),
      reply({ id: "orphan", parentId: "gone" }),
    ]);
    expect(ids(roots)).toEqual(["b", "a"]);
    expect(ids([...childrenOf("a")])).toEqual(["c2", "c1"]);
    expect(ids([...childrenOf("c1")])).toEqual(["g"]);
    expect(childrenOf("b")).toHaveLength(0);
    // The same empty list each time, so a leaf's memoized render can bail out.
    expect(childrenOf("b")).toBe(childrenOf("g"));
  });
});
