import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureStoryData,
  guestbookRepo,
} from "@novelsync/story-data-client";

const at = "2026-10-03T12:00:00Z";
const wire = (id: string, parentId: string | null = null) => ({
  id,
  entryId: "post",
  parentId,
  authorId: "u2",
  authorUsername: "bob",
  content: "hi",
  createdAt: at,
  updatedAt: at,
  upvoteCount: 0,
  downvoteCount: 0,
});
const respondWith = (body: unknown) => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

beforeEach(() => {
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => ({ uid: "u1", token: "token" }),
    getUid: () => "u1",
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("guestbookRepo.listReplyPage", () => {
  it("asks for a bounded page and maps the paged response", async () => {
    const fetcher = respondWith({
      replies: [wire("child", "root"), wire("root")],
      nextCursor: "older",
      totalCount: 42,
    });

    const page = await guestbookRepo.listReplyPage("owner", "post", "c 1");

    expect(fetcher.mock.calls[0][0]).toBe(
      "https://story-data.test/v1/public/guestbooks/owner/entries/post/replies?limit=20&cursor=c+1",
    );
    expect(page).toMatchObject({ nextCursor: "older", totalCount: 42 });
    expect(page.replies[0]).toMatchObject({
      id: "child",
      parentId: "root",
      createdAt: new Date(at),
      userVote: null,
    });
  });

  it("treats the bare array of an older story-data as the whole thread", async () => {
    respondWith([wire("b"), wire("a")]);

    const page = await guestbookRepo.listReplyPage("owner", "post");

    expect(page.replies.map((reply) => reply.id)).toEqual(["b", "a"]);
    expect(page.totalCount).toBe(2);
    expect(page.nextCursor).toBeUndefined();
  });

  it("reports the last page with no cursor", async () => {
    respondWith({ replies: [], totalCount: 0 });
    const page = await guestbookRepo.listReplyPage("owner", "post");
    expect(page).toEqual({ replies: [], nextCursor: undefined, totalCount: 0 });
  });
});
