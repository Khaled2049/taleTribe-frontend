import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User as FirebaseUser } from "firebase/auth";
import { profileRepo, type PublicProfile } from "@novelsync/story-data-client";

vi.mock("@novelsync/platform-auth", () => ({ auth: { currentUser: null } }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => ({
      username: "old-name",
      bio: "from Firestore",
      createdAt: "2026-01-01",
      lastLogin: "2026-10-01",
    }),
  })),
}));
vi.mock("@novelsync/platform-auth/firestore", () => ({ firestore: {} }));

import { useAuthStore } from "@/stores/authStore";
import { appQueryClient } from "@/lib/queryClient";
import { publicProfileQuery } from "@/hooks/queries/useUserQueries";

const account = (uid: string) =>
  ({
    uid,
    displayName: "old-name",
    photoURL: null,
    getIdTokenResult: vi.fn(async () => ({ claims: {} })),
  }) as unknown as FirebaseUser;
const profile = {
  uid: "viewer",
  username: "current-name",
  bio: "from API",
  followerCount: 2,
  isWriter: true,
} as PublicProfile;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  appQueryClient.clear();
  useAuthStore.setState({ user: null, loading: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  appQueryClient.clear();
});

describe("Guestbook auth enrichment", () => {
  it("starts profile and follow reads together and seeds the shared profile cache", async () => {
    const pendingProfile = deferred<PublicProfile>();
    const pendingFollows = deferred<{
      following: string[];
      followers: string[];
    }>();
    const getMe = vi
      .spyOn(profileRepo, "getMe")
      .mockReturnValue(pendingProfile.promise);
    const getFollows = vi
      .spyOn(profileRepo, "getMyFollows")
      .mockReturnValue(pendingFollows.promise);
    const publicRead = vi.spyOn(profileRepo, "get").mockResolvedValue(profile);
    const hydrating = useAuthStore.getState().hydrateUser(account("viewer"));
    await vi.waitFor(() => {
      expect(getMe).toHaveBeenCalledTimes(1);
      expect(getFollows).toHaveBeenCalledTimes(1);
    });
    pendingFollows.resolve({ following: ["writer"], followers: [] });
    expect(useAuthStore.getState().loading).toBe(true);
    pendingProfile.resolve(profile);
    await hydrating;
    expect(useAuthStore.getState().user).toMatchObject({
      uid: "viewer",
      username: "current-name",
      bio: "from API",
      following: ["writer"],
    });
    expect(
      appQueryClient.getQueryData(publicProfileQuery("viewer").queryKey),
    ).toEqual(profile);
    await appQueryClient.fetchQuery(publicProfileQuery("viewer"));
    expect(publicRead).not.toHaveBeenCalled();
  });

  it("preserves follow data when the profile read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(profileRepo, "getMe").mockRejectedValue(
      new Error("profile offline"),
    );
    vi.spyOn(profileRepo, "getMyFollows").mockResolvedValue({
      following: ["writer"],
      followers: [],
    });
    const create = vi.spyOn(profileRepo, "createMe");
    await useAuthStore.getState().hydrateUser(account("viewer"));
    expect(useAuthStore.getState().user).toMatchObject({
      uid: "viewer",
      username: "old-name",
      following: ["writer"],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a missing legacy profile while retaining the parallel follow read", async () => {
    vi.spyOn(profileRepo, "getMe").mockResolvedValue(null);
    const getFollows = vi.spyOn(profileRepo, "getMyFollows").mockResolvedValue({
      following: ["writer"],
      followers: [],
    });
    const create = vi.spyOn(profileRepo, "createMe").mockResolvedValue(profile);
    await useAuthStore.getState().hydrateUser(account("viewer"));
    expect(getFollows).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ username: "old-name" }),
    );
    expect(useAuthStore.getState().user).toMatchObject({
      username: "current-name",
      following: ["writer"],
    });
    expect(
      appQueryClient.getQueryData(publicProfileQuery("viewer").queryKey),
    ).toEqual(profile);
  });

  it("does not apply or cache a superseded hydration after sign-out", async () => {
    const pendingProfile = deferred<PublicProfile>();
    vi.spyOn(profileRepo, "getMe").mockReturnValue(pendingProfile.promise);
    vi.spyOn(profileRepo, "getMyFollows").mockResolvedValue({
      following: ["writer"],
      followers: [],
    });
    const hydrating = useAuthStore.getState().hydrateUser(account("viewer"));
    await vi.waitFor(() => expect(profileRepo.getMe).toHaveBeenCalledTimes(1));
    await useAuthStore.getState().hydrateUser(null);
    pendingProfile.resolve(profile);
    await hydrating;
    expect(useAuthStore.getState().user).toBeNull();
    expect(
      appQueryClient.getQueryData(publicProfileQuery("viewer").queryKey),
    ).toBeUndefined();
  });
});
