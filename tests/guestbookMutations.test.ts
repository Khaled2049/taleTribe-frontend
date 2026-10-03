import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  guestbookRepo,
  type IGuestbookEntry,
  type IGuestbookReply,
} from "@novelsync/story-data-client";
import { guestbookMutations, type EntryPages } from "@/lib/guestbookMutations";
import { guestbookRepliesKey } from "@/lib/guestbookReplies";

vi.mock("@novelsync/story-data-client", () => ({
  guestbookRepo: {
    createEntry: vi.fn(),
    deleteEntry: vi.fn(),
    voteEntry: vi.fn(),
    createReply: vi.fn(),
    updateReply: vi.fn(),
    deleteReply: vi.fn(),
    voteReply: vi.fn(),
  },
}));

const wall = (filter: string, viewer = "me") => [
  "guestbook",
  "wall",
  filter,
  viewer,
];
const owner = (id = "me", viewer: string | null = "me") => [
  "guestbook",
  id,
  viewer,
];
const entry = (overrides: Partial<IGuestbookEntry> = {}): IGuestbookEntry => ({
  id: "post",
  ownerId: "me",
  ownerUsername: "Me",
  authorId: "me",
  authorUsername: "Me",
  content: "hello",
  createdAt: new Date("2026-10-03T12:00:00Z"),
  commentCount: 0,
  upvoteCount: 2,
  downvoteCount: 0,
  userVote: null,
  ...overrides,
});
const pages = (
  entries: IGuestbookEntry[],
  totalCount?: number,
): EntryPages => ({
  pages: [{ entries, totalCount, nextCursor: "older" }],
  pageParams: [undefined],
});
const reply = (overrides: Partial<IGuestbookReply> = {}): IGuestbookReply => ({
  id: "r1",
  entryId: "post",
  content: "hi",
  authorId: "me",
  authorUsername: "Me",
  parentId: null,
  createdAt: new Date("2026-10-03T12:05:00Z"),
  updatedAt: new Date("2026-10-03T12:05:00Z"),
  upvoteCount: 0,
  downvoteCount: 0,
  userVote: null,
  ...overrides,
});
const thread = (viewer: string | null = "me") =>
  guestbookRepliesKey("me", "post", viewer);
const replies = (viewer: string | null = "me") =>
  client.getQueryData<IGuestbookReply[]>(thread(viewer));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
let client: QueryClient;
let current: boolean;
let mutations: ReturnType<typeof guestbookMutations>;
const subscriptions: (() => void)[] = [];
const data = (key: unknown[]) => client.getQueryData<EntryPages>(key)!;
const rows = (key: unknown[]) =>
  data(key).pages.flatMap((page) => page.entries);

beforeEach(() => {
  vi.resetAllMocks();
  current = true;
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: 120_000, retry: false } },
  });
  mutations = guestbookMutations(client, "me", () => current);
  vi.mocked(guestbookRepo.deleteEntry).mockResolvedValue(undefined);
  vi.mocked(guestbookRepo.voteEntry).mockResolvedValue(undefined);
  vi.mocked(guestbookRepo.deleteReply).mockResolvedValue(undefined);
  vi.mocked(guestbookRepo.voteReply).mockResolvedValue(undefined);
});
afterEach(() => {
  subscriptions.splice(0).forEach((off) => off());
  client.clear();
});

describe("Guestbook mutations across cached views", () => {
  it("keeps server chronology when concurrent create responses arrive out of order", async () => {
    client.setQueryData(owner(), pages([], 0));
    const first = deferred<IGuestbookEntry>();
    const older = entry({
      id: "older",
      createdAt: new Date("2026-10-03T12:00:00Z"),
    });
    const newer = entry({
      id: "newer",
      createdAt: new Date("2026-10-03T12:00:01Z"),
    });
    vi.mocked(guestbookRepo.createEntry)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(newer);
    const pending = mutations.createEntry({ ...older, id: "temp-older" });
    await vi.waitFor(() =>
      expect(guestbookRepo.createEntry).toHaveBeenCalledTimes(1),
    );
    await mutations.createEntry({ ...newer, id: "temp-newer" });
    first.resolve(older);
    await pending;
    expect(rows(owner()).map((row) => row.id)).toEqual(["newer", "older"]);
    expect(data(owner()).pages[0].totalCount).toBe(2);
  });

  it.each(["me", "other-wall"])(
    "creates on %s in all eligible caches, even while Following is selected",
    async (ownerId) => {
      for (const key of [
        wall("all"),
        wall("mine"),
        wall("following"),
        owner(ownerId),
        wall("all", "other"),
      ]) {
        client.setQueryData(key, pages([], key.length === 3 ? 0 : undefined));
      }
      const saved = entry({ ownerId });
      const request = deferred<IGuestbookEntry>();
      vi.mocked(guestbookRepo.createEntry).mockReturnValue(request.promise);
      const pending = mutations.createEntry({ ...saved, id: "temp-1" });
      await vi.waitFor(() => expect(rows(wall("all"))[0]?.id).toBe("temp-1"));
      expect(rows(wall("following"))).toEqual([]);
      expect(rows(wall("mine"))).toHaveLength(ownerId === "me" ? 1 : 0);
      request.resolve(saved);
      await pending;
      expect(rows(wall("all"))).toEqual([saved]);
      expect(rows(owner(ownerId))).toEqual([saved]);
      expect(data(owner(ownerId)).pages[0].totalCount).toBe(1);
      expect(data(owner(ownerId)).pages[0].nextCursor).toBe("older");
      expect(data(owner(ownerId)).pageParams).toEqual([undefined]);
      expect(rows(wall("all", "other"))).toEqual([]);
      expect(client.getQueryState(wall("all", "other"))?.isInvalidated).toBe(
        false,
      );
    },
  );

  it("rolls back only its placeholder and preserves a concurrent successful post", async () => {
    client.setQueryData(owner(), pages([entry()], 1));
    client.setQueryData(wall("all"), pages([entry()]));
    const failed = deferred<IGuestbookEntry>();
    vi.mocked(guestbookRepo.createEntry)
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce(entry({ id: "second" }));
    const first = mutations.createEntry(entry({ id: "temp-first" }));
    const rejection = expect(first).rejects.toThrow("offline");
    await vi.waitFor(() => expect(rows(owner())).toHaveLength(2));
    await mutations.createEntry(entry({ id: "temp-second" }));
    failed.reject(new Error("offline"));
    await rejection;
    expect(rows(owner()).map((e) => e.id)).toEqual(["second", "post"]);
    expect(data(owner()).pages[0].totalCount).toBe(2);
  });

  it("deduplicates a server entry already fetched while create was pending", async () => {
    client.setQueryData(owner(), pages([], 0));
    const request = deferred<IGuestbookEntry>();
    vi.mocked(guestbookRepo.createEntry).mockReturnValue(request.promise);
    const pending = mutations.createEntry(entry({ id: "temp-1" }));
    await vi.waitFor(() => expect(rows(owner())).toHaveLength(1));
    client.setQueryData(owner(), pages([entry()], 1));
    request.resolve(entry());
    await pending;
    expect(rows(owner())).toHaveLength(1);
    expect(data(owner()).pages[0].totalCount).toBe(1);
  });

  it("does not synthesize a complete cache for an unfetched view", async () => {
    vi.mocked(guestbookRepo.createEntry).mockResolvedValue(entry());
    await mutations.createEntry(entry({ id: "temp-1" }));
    expect(client.getQueryData(owner())).toBeUndefined();
    expect(client.getQueryData(wall("all"))).toBeUndefined();
  });

  it("removes deleted entries from every page and preserves cursors and other viewers", async () => {
    const cached: EntryPages = {
      pages: [
        {
          entries: [entry({ id: "newer" })],
          totalCount: 12,
          nextCursor: "page2",
        },
        { entries: [entry()], nextCursor: "page3" },
      ],
      pageParams: [undefined, "page2"],
    };
    for (const key of [
      owner(),
      wall("all"),
      wall("mine"),
      wall("following"),
      owner("me", "other"),
    ]) {
      client.setQueryData(key, cached);
    }
    await mutations.deleteEntry(entry());
    for (const key of [owner(), wall("all"), wall("mine"), wall("following")]) {
      expect(rows(key).map((e) => e.id)).toEqual(["newer"]);
      expect(data(key).pages[1].nextCursor).toBe("page3");
      expect(data(key).pageParams).toEqual([undefined, "page2"]);
    }
    expect(data(owner()).pages[0].totalCount).toBe(11);
    expect(rows(owner("me", "other"))).toHaveLength(2);
  });

  it("adjusts the owner total even when the deleted entry was not loaded in that view", async () => {
    client.setQueryData(owner(), pages([entry({ id: "newer" })], 12));
    await mutations.deleteEntry(entry());
    expect(data(owner()).pages[0].totalCount).toBe(11);
  });

  it("leaves all copies intact after a failed deletion", async () => {
    client.setQueryData(owner(), pages([entry()], 1));
    vi.mocked(guestbookRepo.deleteEntry).mockRejectedValue(
      new Error("forbidden"),
    );
    await expect(mutations.deleteEntry(entry())).rejects.toThrow("forbidden");
    expect(rows(owner())).toEqual([entry()]);
    expect(data(owner()).pages[0].totalCount).toBe(1);
  });

  it("shares votes across views without refetching the active feed", async () => {
    const post = entry({ userVote: "down", downvoteCount: 1 });
    client.setQueryData(owner(), pages([post], 1));
    client.setQueryData(wall("all"), pages([post]));
    const read = vi.fn(async () => pages([post]));
    const observer = new QueryObserver(client, {
      queryKey: wall("all"),
      queryFn: read,
    });
    subscriptions.push(observer.subscribe(() => {}));
    await mutations.voteEntry(post);
    expect(guestbookRepo.voteEntry).toHaveBeenCalledWith("me", "post", "up");
    for (const key of [owner(), wall("all")]) {
      expect(rows(key)[0]).toMatchObject({
        userVote: "up",
        upvoteCount: 3,
        downvoteCount: 0,
      });
    }
    expect(read).not.toHaveBeenCalled();
    expect(client.getQueryState(owner())?.isInvalidated).toBe(true);
    // A stale prop from another control must toggle the current cache value.
    await mutations.voteEntry(post);
    expect(rows(owner())[0]).toMatchObject({ userVote: null, upvoteCount: 2 });
  });

  it("rolls back vote fields without losing a concurrent reply-count update", async () => {
    client.setQueryData(owner(), pages([entry()], 1));
    client.setQueryData(wall("all"), pages([entry()]));
    const request = deferred<void>();
    vi.mocked(guestbookRepo.voteEntry).mockReturnValue(request.promise);
    const pending = mutations.voteEntry(entry());
    const rejected = expect(pending).rejects.toThrow("offline");
    await vi.waitFor(() => expect(rows(owner())[0].userVote).toBe("up"));
    mutations.replyCount("me", "post", 4);
    request.reject(new Error("offline"));
    await rejected;
    for (const key of [owner(), wall("all")]) {
      expect(rows(key)[0]).toMatchObject({
        userVote: null,
        upvoteCount: 2,
        commentCount: 4,
      });
    }
  });

  it("coalesces simultaneous votes from multiple mounted controls", async () => {
    client.setQueryData(owner(), pages([entry()], 1));
    const request = deferred<void>();
    vi.mocked(guestbookRepo.voteEntry).mockReturnValue(request.promise);
    const first = mutations.voteEntry(entry());
    const second = guestbookMutations(client, "me", () => current).voteEntry(
      entry(),
    );
    await vi.waitFor(() =>
      expect(guestbookRepo.voteEntry).toHaveBeenCalledTimes(1),
    );
    request.resolve();
    await Promise.all([first, second]);
    expect(rows(owner())[0].upvoteCount).toBe(3);
  });

  it("ignores an older feed read completing after deletion", async () => {
    client.setQueryData(wall("all"), pages([entry()]));
    const request = deferred<EntryPages>();
    const oldRead = client
      .fetchQuery({
        queryKey: wall("all"),
        queryFn: () => request.promise,
        staleTime: 0,
      })
      .catch(() => {});
    await mutations.deleteEntry(entry());
    request.resolve(pages([entry()]));
    await oldRead;
    expect(rows(wall("all"))).toEqual([]);
  });

  it("restarts an initial active load instead of leaving it cancelled with no data", async () => {
    const oldRead = deferred<EntryPages>();
    const read = vi
      .fn()
      .mockReturnValueOnce(oldRead.promise)
      .mockResolvedValue(pages([entry()]));
    const observer = new QueryObserver(client, {
      queryKey: wall("all"),
      queryFn: read,
    });
    subscriptions.push(observer.subscribe(() => {}));
    vi.mocked(guestbookRepo.createEntry).mockResolvedValue(entry());
    await mutations.createEntry(entry({ id: "temp-1" }));
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual(pages([entry()])),
    );
    oldRead.resolve(pages([]));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not repopulate caches after an account switch during a write", async () => {
    client.setQueryData(owner(), pages([], 0));
    const request = deferred<IGuestbookEntry>();
    vi.mocked(guestbookRepo.createEntry).mockReturnValue(request.promise);
    const pending = mutations.createEntry(entry({ id: "temp-1" }));
    await vi.waitFor(() =>
      expect(guestbookRepo.createEntry).toHaveBeenCalledOnce(),
    );
    current = false;
    client.clear();
    client.setQueryData(wall("all", "other"), pages([]));
    request.resolve(entry());
    await pending;
    expect(client.getQueryData(owner())).toBeUndefined();
    expect(rows(wall("all", "other"))).toEqual([]);
    expect(client.getQueryState(wall("all", "other"))?.isInvalidated).toBe(
      false,
    );
  });

  it("adds a created reply to the cached thread and counts it everywhere", async () => {
    client.setQueryData(thread(), [reply()]);
    client.setQueryData(wall("all"), pages([entry({ commentCount: 1 })]));
    client.setQueryData(owner(), pages([entry({ commentCount: 1 })], 1));
    const created = reply({ id: "r2", parentId: "r1" });
    vi.mocked(guestbookRepo.createReply).mockResolvedValue(created);
    const read = vi.fn(async () => pages([entry()]));
    const observer = new QueryObserver(client, {
      queryKey: wall("all"),
      queryFn: read,
      staleTime: 120_000,
    });
    subscriptions.push(observer.subscribe(() => {}));

    await mutations.createReply("me", "post", "hi", "r1");

    expect(replies()!.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(rows(wall("all"))[0].commentCount).toBe(2);
    expect(rows(owner())[0].commentCount).toBe(2);
    // The count is exact, so the mounted feed is not downloaded again.
    expect(read).not.toHaveBeenCalled();
    expect(client.getQueryState(thread())?.isInvalidated).toBe(false);
  });

  it("removes a deleted reply's descendants and their share of the count", async () => {
    client.setQueryData(thread(), [
      reply({ id: "grandchild", parentId: "child" }),
      reply({ id: "child", parentId: "r1" }),
      reply({ id: "other" }),
      reply(),
    ]);
    client.setQueryData(wall("all"), pages([entry({ commentCount: 4 })]));

    await mutations.deleteReply("me", "post", "r1");

    expect(replies()!.map((r) => r.id)).toEqual(["other"]);
    expect(rows(wall("all"))[0].commentCount).toBe(1);
  });

  it("replaces an edited reply without touching the count", async () => {
    client.setQueryData(thread(), [reply({ id: "r2" }), reply()]);
    client.setQueryData(wall("all"), pages([entry({ commentCount: 2 })]));
    vi.mocked(guestbookRepo.updateReply).mockResolvedValue(
      reply({ content: "edited" }),
    );

    await mutations.editReply("me", "post", "r1", "edited");

    expect(replies()!.map((r) => r.content)).toEqual(["hi", "edited"]);
    expect(rows(wall("all"))[0].commentCount).toBe(2);
  });

  it("leaves the thread alone when a reply write fails", async () => {
    client.setQueryData(thread(), [reply()]);
    client.setQueryData(wall("all"), pages([entry({ commentCount: 1 })]));
    vi.mocked(guestbookRepo.createReply).mockRejectedValue(new Error("no"));

    await expect(
      mutations.createReply("me", "post", "hi", null),
    ).rejects.toThrow("no");

    expect(replies()).toEqual([reply()]);
    expect(rows(wall("all"))[0].commentCount).toBe(1);
  });

  it("discards a thread read that started before the reply was written", async () => {
    const stale = deferred<IGuestbookReply[]>();
    const created = reply({ id: "r2" });
    const read = vi
      .fn<() => Promise<IGuestbookReply[]>>()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValue([created, reply()]);
    const observer = new QueryObserver(client, {
      queryKey: thread(),
      queryFn: read,
    });
    subscriptions.push(observer.subscribe(() => {}));
    vi.mocked(guestbookRepo.createReply).mockResolvedValue(created);

    await mutations.createReply("me", "post", "hi", null);
    stale.resolve([reply()]);

    await vi.waitFor(() =>
      expect(replies()!.map((r) => r.id)).toEqual(["r2", "r1"]),
    );
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("asks the server for the count when the thread was never cached", async () => {
    client.setQueryData(wall("all"), pages([entry()]));
    client.setQueryData(owner(), pages([entry()], 1));
    vi.mocked(guestbookRepo.createReply).mockResolvedValue(reply());
    const observer = new QueryObserver(client, {
      queryKey: wall("all"),
      queryFn: async () => pages([entry({ commentCount: 3 })]),
    });
    subscriptions.push(observer.subscribe(() => {}));

    await mutations.createReply("me", "post", "hi", null);

    await vi.waitFor(() => expect(rows(wall("all"))[0].commentCount).toBe(3));
    expect(client.getQueryState(owner())?.isInvalidated).toBe(true);
    expect(replies()).toBeUndefined();
    // A successful full-thread read additionally patches every cached copy.
    mutations.replyCount("me", "post", 3);
    expect(rows(owner())[0].commentCount).toBe(3);
  });

  it("keeps a reply vote in the cached thread and rolls back only the vote", async () => {
    client.setQueryData(thread(), [reply({ upvoteCount: 2 })]);
    await mutations.voteReply("me", reply({ upvoteCount: 2 }));
    expect(replies()![0]).toMatchObject({ userVote: "up", upvoteCount: 3 });
    expect(guestbookRepo.voteReply).toHaveBeenCalledWith(
      "me",
      "post",
      "r1",
      "up",
    );

    const failed = deferred<void>();
    vi.mocked(guestbookRepo.voteReply).mockReturnValue(failed.promise);
    const current = replies()![0];
    const vote = mutations.voteReply("me", current);
    await vi.waitFor(() => expect(replies()![0].userVote).toBeNull());
    client.setQueryData(thread(), [{ ...replies()![0], content: "edited" }]);
    failed.reject(new Error("no"));
    await expect(vote).rejects.toThrow("no");
    expect(replies()![0]).toMatchObject({
      userVote: "up",
      upvoteCount: 3,
      content: "edited",
    });
  });

  it("does not write another account's thread after the viewer changes", async () => {
    client.setQueryData(thread(), [reply()]);
    client.setQueryData(wall("all"), pages([entry({ commentCount: 1 })]));
    const pending = deferred<IGuestbookReply>();
    vi.mocked(guestbookRepo.createReply).mockReturnValue(pending.promise);

    const write = mutations.createReply("me", "post", "hi", null);
    current = false;
    pending.resolve(reply({ id: "r2" }));
    await write;

    expect(replies()).toEqual([reply()]);
    expect(rows(wall("all"))[0].commentCount).toBe(1);
  });
});
