import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureStoryData,
  request,
  StoryDataAuthError,
  StoryDataConflictError,
  StoryDataError,
  isNotFound,
} from "../packages/story-data-client/src/index";

type Call = { url: string; init: RequestInit };

let calls: Call[];

const respond = (status: number, body?: unknown) =>
  vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        body === undefined
          ? Promise.reject(new SyntaxError("Unexpected end of JSON input"))
          : Promise.resolve(body),
    });
  });

const headersOf = (call: Call) => call.init.headers as Record<string, string>;

const configure = (user: { uid: string; token: string | null } | null) =>
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => user,
    getUid: () => user?.uid ?? null,
  });

beforeEach(() => {
  calls = [];
  configure({ uid: "u1", token: "tok" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("204 responses", () => {
  // PUT /v1/profiles/{id}/follow returns 204. Reading it as JSON threw, which
  // made a successful follow surface as "Failed to follow user".
  it("resolves undefined instead of parsing an empty body", async () => {
    vi.stubGlobal("fetch", respond(204));
    await expect(
      request("/v1/profiles/bob/follow", { method: "PUT", auth: "required" }),
    ).resolves.toBeUndefined();
  });
});

describe("auth modes", () => {
  it("throws before fetching when required auth has no user", async () => {
    configure(null);
    const fetchMock = respond(200, {});
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/v1/stories", { auth: "required" })).rejects.toBeInstanceOf(
      StoryDataAuthError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still fetches for optional auth with no user, without an Authorization header", async () => {
    configure(null);
    vi.stubGlobal("fetch", respond(200, []));

    await request("/v1/public/guestbooks/bob/entries", { auth: "optional" });
    expect(headersOf(calls[0]).Authorization).toBeUndefined();
  });

  it("sends the bearer token for a signed-in optional-auth read", async () => {
    vi.stubGlobal("fetch", respond(200, []));
    await request("/v1/public/guestbooks/bob/entries", { auth: "optional" });
    expect(headersOf(calls[0]).Authorization).toBe("Bearer tok");
  });

  it("omits the dev user header unless configured", async () => {
    vi.stubGlobal("fetch", respond(200, {}));
    await request("/v1/stories", { auth: "required" });
    expect(headersOf(calls[0])["X-User-ID"]).toBeUndefined();

    configureStoryData({
      baseUrl: "https://story-data.test",
      sendDevUserHeader: true,
      getAuthContext: async () => ({ uid: "u1", token: "tok" }),
      getUid: () => "u1",
    });
    await request("/v1/stories", { auth: "required" });
    expect(headersOf(calls[1])["X-User-ID"]).toBe("u1");
  });
});

describe("headers", () => {
  // An unauthenticated GET with no headers stays CORS-simple. Adding
  // Content-Type would cost every public read a preflight.
  it("sets Content-Type only when there is a body", async () => {
    vi.stubGlobal("fetch", respond(200, {}));

    await request("/v1/public/stories", { auth: "none" });
    expect(headersOf(calls[0])["Content-Type"]).toBeUndefined();
    expect(headersOf(calls[0])).toEqual({});

    await request("/v1/stories", { method: "POST", body: { title: "x" }, auth: "none" });
    expect(headersOf(calls[1])["Content-Type"]).toBe("application/json");
    expect(calls[1].init.body).toBe(JSON.stringify({ title: "x" }));
  });

  it("sends If-Match only when a revision is given", async () => {
    vi.stubGlobal("fetch", respond(200, {}));

    await request("/v1/stories/s1", { method: "PATCH", body: {}, auth: "required" });
    expect(headersOf(calls[0])["If-Match"]).toBeUndefined();

    await request("/v1/stories/s1", {
      method: "PATCH",
      body: {},
      auth: "required",
      revision: 7,
    });
    expect(headersOf(calls[1])["If-Match"]).toBe("7");
  });

  it("sends If-Match for revision 0, which is falsy but valid", async () => {
    vi.stubGlobal("fetch", respond(200, {}));
    await request("/v1/stories/s1", { method: "PATCH", body: {}, revision: 0 });
    expect(headersOf(calls[0])["If-Match"]).toBe("0");
  });
});

describe("errors", () => {
  it("maps 409 to StoryDataConflictError", async () => {
    vi.stubGlobal("fetch", respond(409, { error: "revision mismatch" }));
    const error = await request("/v1/stories/s1", {
      method: "PATCH",
      body: {},
      revision: 1,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StoryDataConflictError);
    const conflict = error as StoryDataConflictError;
    expect(conflict.status).toBe(409);
    expect(conflict.message).toBe("revision mismatch");
  });

  // The server's own message replaces the generated one, so a caller matching
  // on `message.includes("(404)")` misses exactly the responses that say so.
  it("keeps status on the error when the server supplies a message", async () => {
    vi.stubGlobal("fetch", respond(404, { error: "story not found" }));
    const error = await request("/v1/public/stories/s1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StoryDataError);
    expect((error as StoryDataError).message).toBe("story not found");
    expect(isNotFound(error)).toBe(true);
  });

  it("falls back to a labelled message when the body has none", async () => {
    vi.stubGlobal("fetch", respond(500));
    const error = await request("/v1/stories", { label: "Story request" }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(StoryDataError);
    const failure = error as StoryDataError;
    expect(failure.message).toBe("Story request failed (500)");
    expect(failure.status).toBe(500);
  });
});

describe("configuration", () => {
  it("throws a directed error when the client was never configured", async () => {
    // Re-import in isolation so the module-level config starts empty.
    vi.resetModules();
    const fresh = await import("../packages/story-data-client/src/request");
    await expect(fresh.request("/v1/stories")).rejects.toThrow(/not configured/);
  });
});
