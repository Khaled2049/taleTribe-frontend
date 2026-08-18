/**
 * Cypress Node tasks: seed Auth + Firestore state and read it back for
 * assertions, all against the local emulators via their REST APIs.
 *
 * Writes carry `Authorization: Bearer owner`, which the emulator treats as the
 * project owner and which therefore BYPASSES firestore.rules. That is the only
 * way to seed rules-protected fields (users.aiUsage / aiSettings / storyCount,
 * jobs/*) — exactly the trick story/scripts/seed-dev-user.mjs already relies on.
 *
 * Plain ESM (.mjs) so cypress.config.mjs can import it under "type": "module".
 */
import { fromFields, toFields } from "./firestoreRest.mjs";

const PROJECT_ID = "story-6f89f";
const AUTH_REST = "http://localhost:9099/identitytoolkit.googleapis.com/v1";
const AUTH_EMU = `http://localhost:9099/emulator/v1/projects/${PROJECT_ID}`;
const FS_REST = `http://localhost:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FS_EMU = `http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const STORY_DATA_URL = "http://127.0.0.1:8084";

const OWNER = { "Content-Type": "application/json", Authorization: "Bearer owner" };

async function jsonOrThrow(res, what) {
  if (!res.ok) {
    throw new Error(`${what} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Create (or fetch) an Auth-emulator user. Returns its uid + a fresh idToken.
 *  signUp doesn't always echo a token, so we always sign in to mint one. */
async function ensureAuthUser(email, password) {
  const signUp = await fetch(`${AUTH_REST}/accounts:signUp?key=fake-key`, {
    method: "POST",
    headers: OWNER,
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const created = await signUp.json();
  if (created.error && created.error.message !== "EMAIL_EXISTS") {
    throw new Error(`auth signUp failed: ${JSON.stringify(created.error)}`);
  }

  const signIn = await fetch(
    `${AUTH_REST}/accounts:signInWithPassword?key=fake-key`,
    {
      method: "POST",
      headers: OWNER,
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const s = await jsonOrThrow(signIn, "auth signIn");
  return { uid: s.localId, idToken: s.idToken };
}

/** PATCH (merge) a document's fields. Absent fields are left untouched. */
async function patchDoc(path, fields) {
  const res = await fetch(`${FS_REST}/${path}`, {
    method: "PATCH",
    headers: OWNER,
    body: JSON.stringify({ fields: toFields(fields) }),
  });
  await jsonOrThrow(res, `patch ${path}`);
}

/** Seed an invited+approved user with a profile doc. Returns its uid. */
async function seedUser({ email, password, user = {} }) {
  const { uid } = await ensureAuthUser(email, password);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // invite doc — status "completed" satisfies the invite-only sign-up gate.
  await patchDoc(`invites/${encodeURIComponent(email)}`, {
    email,
    status: "completed",
    requestedAt: now,
    approvedAt: now,
    sentAt: now,
    completedAt: now,
    linkSentCount: 1,
  });

  // user profile — quota fields default to a clean slate; `user` overrides them.
  // `followers`/`following` MUST be present: the own-profile firestore.rules
  // update branch requires `request.resource.data.followers == resource.data
  // .followers`, so the app's lastLogin merge on sign-in fails without them.
  await patchDoc(`users/${uid}`, {
    email,
    username: "e2e_user",
    bio: "E2E user",
    createdAt: now,
    lastLogin: now,
    isAnonymous: false,
    aiUsage: 0,
    lastAiUsageDate: today,
    indexUsage: 0,
    lastIndexUsageDate: today,
    storyCount: 0,
    followers: ["default"],
    following: ["default"],
    stories: [],
    posts: [],
    likedPosts: [],
    savedPosts: [],
    ...user,
  });

  return { uid };
}

/** Sign in and return a fresh Firebase ID token (for direct cy.request calls). */
async function getIdToken({ email, password }) {
  const { uid, idToken } = await ensureAuthUser(email, password);
  return { idToken, uid };
}

/** Merge-update arbitrary fields on users/{uid} (e.g. force quota for a 429). */
async function setUserFields({ uid, fields }) {
  await patchDoc(`users/${uid}`, fields);
  return null;
}

/** Read a single document. Returns its decoded fields (with `id`) or null. */
async function getDoc(path) {
  const res = await fetch(`${FS_REST}/${path}`, { headers: OWNER });
  if (res.status === 404) return null;
  const doc = await jsonOrThrow(res, `get ${path}`);
  return { id: doc.name.split("/").pop(), ...fromFields(doc.fields ?? {}) };
}

/** List documents in a (sub)collection. `path` is e.g. "jobs" or
 *  "stories/<id>/chapters". Returns decoded docs (each with `id`). */
async function listDocs(path) {
  const res = await fetch(`${FS_REST}/${path}?pageSize=300`, { headers: OWNER });
  const data = await jsonOrThrow(res, `list ${path}`);
  return (data.documents ?? []).map((d) => ({
    id: d.name.split("/").pop(),
    ...fromFields(d.fields ?? {}),
  }));
}

/**
 * Call story-data as a given user. AUTH_MODE=dev in its docker-compose accepts
 * X-User-ID in place of a Firebase token, which is what lets a Node task read
 * back what the browser just wrote.
 *
 * Note there is no story-data reset: resetEmulators clears Auth, so every run
 * gets fresh uids and rows from earlier runs are orphaned rather than
 * colliding. Assertions must therefore be scoped to the spec's own uid, never
 * to a global count.
 */
async function storyData({ method = "GET", path, uid, body }) {
  const res = await fetch(`${STORY_DATA_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-User-ID": uid },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    return { __error: true, status: res.status, body: await res.text() };
  }
  return res.status === 204 ? null : res.json();
}

/** Create `count` stories straight through the API, concurrently. */
async function seedStoryDataStories({ uid, count, titlePrefix = "Filler" }) {
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      storyData({
        method: "POST",
        path: "/v1/stories",
        uid,
        body: { title: `${titlePrefix} ${i + 1}`, description: "", authorName: "e2e", tags: [], published: false },
      }),
    ),
  );
  return null;
}

/** Wipe all Firestore docs + Auth accounts so each spec starts clean. */
async function resetEmulators() {
  await fetch(FS_EMU, { method: "DELETE", headers: OWNER });
  await fetch(`${AUTH_EMU}/accounts`, { method: "DELETE", headers: OWNER });
  return null;
}

export function registerTasks(on) {
  on("task", {
    seedUser: (arg) => seedUser(arg),
    getIdToken: (arg) => getIdToken(arg),
    setUserFields: (arg) => setUserFields(arg),
    getDoc: (arg) => getDoc(arg),
    listDocs: (arg) => listDocs(arg),
    resetEmulators: () => resetEmulators(),
    storyData: (arg) => storyData(arg),
    seedStoryDataStories: (arg) => seedStoryDataStories(arg),
  });
}
