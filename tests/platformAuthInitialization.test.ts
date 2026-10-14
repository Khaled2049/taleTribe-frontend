import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  app: { name: "fixture" },
  auth: {
    currentUser: null as null | {
      uid: string;
      getIdToken: () => Promise<string>;
    },
  },
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  initializeAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));
vi.mock("firebase/app", () => ({ initializeApp: sdk.initializeApp }));
vi.mock("firebase/auth", () => ({
  getAuth: sdk.getAuth,
  initializeAuth: sdk.initializeAuth,
  connectAuthEmulator: sdk.connectAuthEmulator,
  indexedDBLocalPersistence: "indexed-db",
  browserLocalPersistence: "local-storage",
  onAuthStateChanged: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.auth.currentUser = null;
  sdk.initializeApp.mockReturnValue(sdk.app);
  sdk.getAuth.mockReturnValue(sdk.auth);
  sdk.initializeAuth.mockReturnValue(sdk.auth);
});

describe("explicit platform auth bootstrap", () => {
  it("does not initialize Firebase on import and fails clearly before bootstrap", async () => {
    const core = await import("../packages/platform-auth/src/index");
    expect(sdk.initializeApp).not.toHaveBeenCalled();
    expect(() => core.getPlatformAuth()).toThrow("initializePlatformAuth");
    await expect(core.getAuthContext()).rejects.toThrow(
      "initializePlatformAuth",
    );
  });

  it("preserves web getAuth and accepts equivalent config exactly once", async () => {
    const core = await import("../packages/platform-auth/src/index");
    const options = {
      platform: "web" as const,
      firebase: { apiKey: "fixture", projectId: "test" },
    };
    const result = core.initializePlatformAuth(options);
    expect(
      core.initializePlatformAuth({
        firebase: { projectId: "test", apiKey: "fixture" },
        platform: "web",
      }),
    ).toEqual(result);
    expect(sdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdk.getAuth).toHaveBeenCalledWith(sdk.app);
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
    options.firebase.projectId = "different";
    expect(() => core.initializePlatformAuth(options)).toThrow(
      "different configuration",
    );
    expect(core.getPlatformAuth().options.firebase.projectId).toBe("test");
  });

  it("uses mobile persistence without getAuth and connects the explicit emulator once", async () => {
    const core = await import("../packages/platform-auth/src/index");
    const options = {
      firebase: { apiKey: "fixture" },
      platform: "mobile" as const,
      emulators: { authUrl: "http://127.0.0.1:9099" },
    };
    core.initializePlatformAuth(options);
    core.initializePlatformAuth(options);
    expect(sdk.getAuth).not.toHaveBeenCalled();
    expect(sdk.initializeAuth).toHaveBeenCalledWith(sdk.app, {
      persistence: ["indexed-db", "local-storage"],
    });
    expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(
      sdk.auth,
      options.emulators.authUrl,
      { disableWarnings: true },
    );
  });

  it("reads the current user and token on each request, including after sign-out", async () => {
    const core = await import("../packages/platform-auth/src/index");
    core.initializePlatformAuth({
      platform: "web",
      firebase: { apiKey: "fixture" },
    });
    const getIdToken = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("refreshed");
    sdk.auth.currentUser = { uid: "reader", getIdToken };
    expect(core.getCurrentUid()).toBe("reader");
    expect(await core.getAuthContext()).toEqual({
      uid: "reader",
      token: "first",
    });
    expect(await core.getAuthContext()).toEqual({
      uid: "reader",
      token: "refreshed",
    });
    sdk.auth.currentUser = null;
    expect(core.getCurrentUid()).toBeNull();
    expect(await core.getAuthContext()).toBeNull();
  });
});
