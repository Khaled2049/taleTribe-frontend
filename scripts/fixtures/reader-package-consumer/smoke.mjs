import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { getPlatformAuth } from "@novelsync/platform-auth";
import { configureStoryData } from "@novelsync/story-data-client";
import {
  ReaderProvider,
  ChapterReader,
  useDisabledReadAloud,
  prefetchStoriesPage,
} from "@novelsync/reader-ui";
import { DEFAULT_READER_SETTINGS } from "@novelsync/reader-ui/routes/Story/constants/readerThemes";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useReaderProfile, queryKeys } from "@novelsync/reader-ui";

assert.throws(() => getPlatformAuth(), /initializePlatformAuth/);
assert.equal(useDisabledReadAloud().status, "idle");
configureStoryData({
  baseUrl: "https://fixture.invalid",
  getAuthContext: async () => null,
  getUid: () => null,
});
let requests = 0;
globalThis.fetch = async (url) => {
  assert(String(url).startsWith("https://fixture.invalid"));
  requests++;
  return new Response(JSON.stringify({ stories: [], nextCursor: null }), {
    headers: { "Content-Type": "application/json" },
  });
};
const first = new QueryClient();
const second = new QueryClient();
await prefetchStoriesPage(first);
assert.equal(requests, 1);
assert.equal(first.getQueryCache().getAll().length, 1);
assert.equal(second.getQueryCache().getAll().length, 0);
first.clear();
second.clear();
const environment = {
  identity: {
    uid: null,
    email: null,
    loading: false,
    isSignedIn: false,
    isAdmin: false,
  },
  viewer: {
    user: null,
    loading: false,
    followUser: async () => {},
    unfollowUser: async () => {},
  },
  preferences: {
    settings: { ...DEFAULT_READER_SETTINGS, theme: "dark" },
    updateSettings() {},
    resetSettings() {},
    isLoading: false,
  },
  appName: "Fixture",
  lookupWord: async () => {
    throw new Error("unused");
  },
  highlights: {
    getByChapter: async () => [],
    save: async (value) => value,
    update: async () => {
      throw new Error("unused");
    },
    delete: async () => {},
  },
};
globalThis.DOMParser = new JSDOM().window.DOMParser;
const html = renderToStaticMarkup(
  React.createElement(
    ReaderProvider,
    { value: environment },
    React.createElement(ChapterReader, {
      currentChapter: {
        id: "fixture",
        title: "Theme title",
        content: "<p>Independent reader</p>",
      },
      currentChapterIndex: 1,
      totalChapters: 2,
      story: { completionStatus: "ongoing", readerNote: "More soon" },
      onBackToDetails() {},
      onPrevChapter() {},
      onNextChapter() {},
    }),
  ),
);
assert(html.includes("Theme title"));
assert(html.includes("text-current"));
assert(html.includes("To be continued"));
assert(html.includes("More soon"));
assert(!html.includes('title="Read aloud"'));
console.log(
  "Packed auth has no import side effect; guest reader and app-owned query clients work.",
);

// Exercise the mobile profile adapter with a real React lifecycle and mocked
// HTTP, including an absent profile. No legacy Firestore SDK is involved.
const dom = new JSDOM("<div id='root'></div>", {
  url: "https://fixture.invalid",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root"));
const profileClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
let identity = environment.identity;
let viewer;
let following = ["author-1"];
const profileRequests = [];
configureStoryData({
  baseUrl: "https://fixture.invalid",
  getAuthContext: async () =>
    identity.uid ? { uid: identity.uid, token: `token-${identity.uid}` } : null,
  getUid: () => identity.uid,
});
globalThis.fetch = async (url, init) => {
  const pathname = new URL(url).pathname;
  profileRequests.push([pathname, init.method]);
  assert.equal(
    new Headers(init.headers).get("Authorization"),
    `Bearer token-${identity.uid}`,
  );
  let value;
  if (pathname === "/v1/profiles/me") {
    if (identity.uid === "missing")
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
      });
    value = {
      userId: identity.uid,
      username: "Writer",
      firstName: "First",
      photoUrl: "https://fixture.invalid/photo",
      followerCount: 1,
      isWriter: true,
    };
  } else if (pathname === "/v1/me/follows")
    value = { following, followers: [] };
  else if (pathname === "/v1/profiles/author-2/follow") {
    following = [...following, "author-2"];
    return new Response(null, { status: 204 });
  } else throw new Error(`Unexpected profile path: ${pathname}`);
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
};
function Probe() {
  viewer = useReaderProfile(identity);
  return null;
}
async function render() {
  await act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: profileClient },
        React.createElement(Probe),
      ),
    ),
  );
}
async function settle(predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  assert(predicate(), "profile contract did not settle");
}
await render();
assert.equal(viewer.user, null);
assert.equal(profileRequests.length, 0);
identity = {
  uid: "reader",
  email: "reader@example.test",
  displayName: "Identity name",
  loading: false,
  isSignedIn: true,
  isAdmin: false,
};
await render();
await settle(
  () =>
    viewer.user?.username === "Writer" &&
    viewer.user.following.includes("author-1"),
);
assert.equal(viewer.user.firstName, "First");
assert.equal(viewer.user.photoURL, "https://fixture.invalid/photo");
assert.equal(
  profileClient.getQueryData(queryKeys.user.publicProfile("reader")).username,
  "Writer",
);
await act(async () => {
  await viewer.followUser("author-2");
});
await settle(() => viewer.user.following.includes("author-2"));
identity = {
  ...identity,
  uid: "missing",
  displayName: "Fallback",
  photoURL: "https://fixture.invalid/identity-photo",
};
await render();
await settle(() => !viewer.loading);
assert.equal(viewer.user.username, "Fallback");
assert.equal(viewer.user.photoURL, identity.photoURL);
assert(
  !profileRequests.some(
    ([url, method]) => url === "/v1/profiles/me" && method !== "GET",
  ),
);
identity = environment.identity;
await render();
await act(async () => profileClient.clear());
assert.equal(viewer.user, null);
assert.equal(
  profileClient.getQueryData(["reader", "reader", "profile"]),
  undefined,
);
await act(async () => root.unmount());
profileClient.clear();
dom.window.close();
console.log(
  "Packed profile adapter passed: guest access, fields, follows, missing-profile fallback, and app-owned sign-out clearing.",
);
