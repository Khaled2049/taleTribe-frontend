import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { IClub } from "@/types/IClub";
import { bookClubRepo } from "@/routes/BookClub/bookClubRepo";
import { bookClubQuery } from "@/hooks/queries/useBookClubQueries";
import { queryKeys } from "@/hooks/queries/queryKeys";

const club = { id: "c1", name: "Club", members: [] } as unknown as IClub;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bookClubQuery", () => {
  it("is keyed where the page and its cache writes look", () => {
    expect(bookClubQuery("c1").queryKey).toEqual(
      queryKeys.bookClubs.detail("c1"),
    );
  });

  it("lets a prefetch satisfy the page's read", async () => {
    const getBookClub = vi
      .spyOn(bookClubRepo, "getBookClub")
      .mockResolvedValue(club);
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery(bookClubQuery("c1"));
    // The route loader and a press on the card can both ask for the same club.
    await queryClient.prefetchQuery(bookClubQuery("c1"));

    expect(getBookClub).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(bookClubQuery("c1").queryKey)).toEqual(
      club,
    );
  });

  it("caches a missing club as null rather than leaving the query empty", async () => {
    vi.spyOn(bookClubRepo, "getBookClub").mockResolvedValue(undefined);
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery(bookClubQuery("gone"));

    expect(queryClient.getQueryData(bookClubQuery("gone").queryKey)).toBeNull();
  });
});
