import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";

vi.mock("@novelsync/platform-auth", () => ({ auth: {} }));
vi.mock("@novelsync/story-data-client", () => ({
  profileRepo: { setFollow: vi.fn() },
}));

import { profileRepo } from "@novelsync/story-data-client";
import { useAuthStore } from "@/stores/authStore";
import { appQueryClient } from "@/lib/queryClient";
import { queryKeys } from "@/hooks/queries/queryKeys";
import type { IUser } from "@/types/IUser";

const key = (filter: string, uid = "viewer") => [
  ...queryKeys.guestbook.wall(filter),
  uid,
];
const user = (uid = "viewer", following: string[] = []) =>
  // These actions only read identity and relationship fields, not Firebase methods.
  ({ uid, following, followers: [], username: uid }) as unknown as IUser;
const subscriptions: (() => void)[] = [];

beforeEach(() => {
  appQueryClient.clear();
  vi.mocked(profileRepo.setFollow).mockReset().mockResolvedValue(undefined);
  useAuthStore.setState({ user: user(), loading: false });
});

afterEach(() => {
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  appQueryClient.clear();
  vi.restoreAllMocks();
});

describe("follow changes refresh cached feeds", () => {
  it.each([true, false])(
    "refreshes active feeds after following=%s",
    async (following) => {
      useAuthStore.setState({
        user: user("viewer", following ? [] : ["writer"]),
      });
      const expected = following ? ["writer post"] : [];
      const reads = ["all", "following"].map((filter) => {
        appQueryClient.setQueryData(
          key(filter),
          following ? [] : ["writer post"],
        );
        const queryFn = vi.fn(async () => expected);
        const observer = new QueryObserver(appQueryClient, {
          queryKey: key(filter),
          queryFn,
        });
        subscriptions.push(observer.subscribe(() => {}));
        return queryFn;
      });
      expect(reads.every((read) => read.mock.calls.length === 0)).toBe(true);

      await useAuthStore
        .getState()
        [following ? "followUser" : "unfollowUser"]("writer");

      expect(profileRepo.setFollow).toHaveBeenCalledWith("writer", following);
      expect(useAuthStore.getState().user?.following).toEqual(
        following ? ["writer"] : [],
      );
      for (const filter of ["all", "following"]) {
        expect(appQueryClient.getQueryData(key(filter))).toEqual(expected);
      }
      reads.forEach((read) => expect(read).toHaveBeenCalledTimes(1));
    },
  );

  it("marks inactive filters stale without touching mine, owner walls, or another viewer", async () => {
    const untouched = [
      key("mine"),
      key("all", "other"),
      key("following", "other"),
      [...queryKeys.guestbook.byOwner("writer"), "viewer"],
    ];
    for (const queryKey of [key("all"), key("following"), ...untouched]) {
      appQueryClient.setQueryData(queryKey, []);
    }
    await useAuthStore.getState().followUser("writer");
    for (const filter of ["all", "following"]) {
      expect(appQueryClient.getQueryState(key(filter))?.isInvalidated).toBe(
        true,
      );
      expect(appQueryClient.getQueryState(key(filter))?.fetchStatus).toBe(
        "idle",
      );
    }
    untouched.forEach((queryKey) =>
      expect(appQueryClient.getQueryState(queryKey)?.isInvalidated).toBe(false),
    );

    const queryFn = vi.fn(async () => ["writer post"]);
    const observer = new QueryObserver(appQueryClient, {
      queryKey: key("following"),
      queryFn,
    });
    subscriptions.push(observer.subscribe(() => {}));
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual(["writer post"]),
    );
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "preserves state when following=%s fails",
    async (following) => {
      const original = following ? [] : ["writer"];
      useAuthStore.setState({ user: user("viewer", original) });
      appQueryClient.setQueryData(key("following"), ["existing post"]);
      vi.mocked(profileRepo.setFollow).mockRejectedValue(new Error("offline"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        useAuthStore
          .getState()
          [following ? "followUser" : "unfollowUser"]("writer"),
      ).rejects.toThrow(
        following ? "Failed to follow user" : "Failed to unfollow user",
      );
      expect(useAuthStore.getState().user?.following).toEqual(original);
      expect(appQueryClient.getQueryData(key("following"))).toEqual([
        "existing post",
      ]);
      expect(
        appQueryClient.getQueryState(key("following"))?.isInvalidated,
      ).toBe(false);
    },
  );

  it.each([true, false])(
    "ignores a delayed following=%s response after switching accounts",
    async (following) => {
      useAuthStore.setState({
        user: user("viewer", following ? [] : ["writer"]),
      });
      let finish!: () => void;
      vi.mocked(profileRepo.setFollow).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const pending = useAuthStore
        .getState()
        [following ? "followUser" : "unfollowUser"]("writer");
      useAuthStore.setState({ user: user("other", ["writer", "someone"]) });
      appQueryClient.setQueryData(key("following", "other"), ["other feed"]);
      finish();
      await pending;
      expect(useAuthStore.getState().user?.following).toEqual([
        "writer",
        "someone",
      ]);
      expect(
        appQueryClient.getQueryState(key("following", "other"))?.isInvalidated,
      ).toBe(false);
    },
  );

  it("discards an initial in-flight feed result from before the follow", async () => {
    let finishOldRead!: (value: string[]) => void;
    const queryFn = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            finishOldRead = resolve;
          }),
      )
      .mockResolvedValue(["writer post"]);
    const observer = new QueryObserver(appQueryClient, {
      queryKey: key("following"),
      queryFn,
    });
    subscriptions.push(observer.subscribe(() => {}));
    await useAuthStore.getState().followUser("writer");
    expect(queryFn).toHaveBeenCalledTimes(2);
    finishOldRead([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer.getCurrentResult().data).toEqual(["writer post"]);
  });
});
