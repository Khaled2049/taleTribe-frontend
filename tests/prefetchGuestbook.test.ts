import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  guestbookRepo,
  profileRepo,
  type PublicProfile,
} from "@novelsync/story-data-client";
import { prefetchGuestbookRoute } from "@/routes/Guestbook/prefetchGuestbook";
import {
  guestbookEntriesQuery,
  wallFeedQuery,
} from "@/hooks/queries/useGuestbookQueries";
import { publicProfileQuery } from "@/hooks/queries/useUserQueries";

const profile = { uid: "owner", username: "Owner" } as PublicProfile;
const page = { entries: [], nextCursor: undefined };
const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => vi.restoreAllMocks());

describe("Guestbook route prefetch", () => {
  it("loads the first home feed page from the confirmed uid and reuses it", async () => {
    const wall = vi.spyOn(guestbookRepo, "listWall").mockResolvedValue(page);
    const queryClient = client();
    await prefetchGuestbookRoute("/", "viewer", queryClient);
    expect(wall).toHaveBeenCalledExactlyOnceWith("all", undefined);
    expect(
      queryClient.getQueryData(wallFeedQuery("viewer", "all").queryKey),
    ).toEqual({ pages: [page], pageParams: [undefined] });
    await prefetchGuestbookRoute("/guestbook", "viewer", queryClient);
    expect(wall).toHaveBeenCalledTimes(1);
  });

  it("never starts a personal feed while signed out", async () => {
    const wall = vi.spyOn(guestbookRepo, "listWall").mockResolvedValue(page);
    await prefetchGuestbookRoute("/", null, client());
    await prefetchGuestbookRoute("/guestbook", null, client());
    expect(wall).not.toHaveBeenCalled();
  });

  it("starts visited profile and entry reads in parallel, with the same keys as the page", async () => {
    let finishProfile!: (value: PublicProfile) => void;
    const profileRead = vi.spyOn(profileRepo, "get").mockImplementation(
      () =>
        new Promise((resolve) => {
          finishProfile = resolve;
        }),
    );
    const entries = vi
      .spyOn(guestbookRepo, "listEntries")
      .mockResolvedValue(page);
    const queryClient = client();
    const pending = prefetchGuestbookRoute(
      "/guestbook/owner",
      "viewer",
      queryClient,
    );
    expect(profileRead).toHaveBeenCalledWith("owner");
    expect(entries).toHaveBeenCalledWith("owner", undefined);
    finishProfile(profile);
    await pending;
    expect(
      queryClient.getQueryData(publicProfileQuery("owner").queryKey),
    ).toEqual(profile);
    expect(
      queryClient.getQueryData(
        guestbookEntriesQuery("owner", "viewer").queryKey,
      ),
    ).toEqual({ pages: [page], pageParams: [undefined] });
    await prefetchGuestbookRoute("/guestbook/owner", "viewer", queryClient);
    expect(profileRead).toHaveBeenCalledTimes(1);
    expect(entries).toHaveBeenCalledTimes(1);
  });

  it("isolates pages by viewer, including an anonymous visited wall", async () => {
    const entries = vi
      .spyOn(guestbookRepo, "listEntries")
      .mockResolvedValue(page);
    vi.spyOn(profileRepo, "get").mockResolvedValue(profile);
    const queryClient = client();
    await prefetchGuestbookRoute("/guestbook/owner", null, queryClient);
    await prefetchGuestbookRoute("/guestbook/owner", "viewer", queryClient);
    expect(entries).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getQueryData(guestbookEntriesQuery("owner", null).queryKey),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(
        guestbookEntriesQuery("owner", "viewer").queryKey,
      ),
    ).toBeDefined();
  });

  it("does not request an owner page for a self redirect or non-wall route", async () => {
    const entries = vi
      .spyOn(guestbookRepo, "listEntries")
      .mockResolvedValue(page);
    const wall = vi.spyOn(guestbookRepo, "listWall").mockResolvedValue(page);
    const queryClient = client();
    await prefetchGuestbookRoute("/guestbook/people", "viewer", queryClient);
    await prefetchGuestbookRoute("/guestbook/settings", "viewer", queryClient);
    await prefetchGuestbookRoute("/guestbook/viewer", "viewer", queryClient);
    expect(entries).not.toHaveBeenCalled();
    expect(wall).toHaveBeenCalledTimes(1);
  });
});
