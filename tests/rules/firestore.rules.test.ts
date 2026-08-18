/**
 * Firestore rules tests for what is left in Firestore after the PostgreSQL
 * cutover: AI chat transcripts, book club chat, the user document, the client
 * rate-limit counters, and MCP access requests.
 *
 * The important assertions here are the negative ones. Firestore is
 * default-deny, so the collections that moved to story-data need no rules at
 * all — but a stray `match` added later would silently reopen them, and these
 * tests are what would catch that.
 *
 * Requires a running Firestore emulator:
 *
 *     firebase emulators:start --only firestore
 *     yarn test:rules
 *
 * Deliberately NOT part of `yarn test` — that runs with no emulator, and a
 * suite that silently passes when its dependency is missing is worse than none.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const OWNER = "owner-uid";
const STRANGER = "stranger-uid";
const STORY = "story-1";
const CHAT = "chat-1";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "rules-test",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

const as = (uid: string | null) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

describe("AI chat sessions", () => {
  it("lets a user create and read their own session", async () => {
    const db = as(OWNER);
    const ref = doc(db, "stories", STORY, "chats", CHAT);
    await assertSucceeds(setDoc(ref, { userId: OWNER, storyId: STORY }));
    await assertSucceeds(getDoc(ref));
  });

  it("refuses a session created in someone else's name", async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), "stories", STORY, "chats", CHAT), { userId: OWNER }),
    );
  });

  it("refuses a stranger reading a session", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "stories", STORY, "chats", CHAT), { userId: OWNER });
    });
    await assertFails(getDoc(doc(as(STRANGER), "stories", STORY, "chats", CHAT)));
  });

  it("never lets a client write a message — only Cloud Functions do", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "stories", STORY, "chats", CHAT), { userId: OWNER });
    });
    await assertFails(
      setDoc(doc(as(OWNER), "stories", STORY, "chats", CHAT, "messages", "m1"), {
        role: "user",
        content: "hi",
      }),
    );
  });
});

describe("the user document", () => {
  it("refuses a client granting itself BYOK or admin", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", OWNER), { username: "owner" });
    });
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, "users", OWNER), { username: "renamed" }, { merge: true }));
    await assertFails(
      setDoc(doc(db, "users", OWNER), { hasCustomAiProvider: true }, { merge: true }),
    );
    await assertFails(setDoc(doc(db, "users", OWNER), { isAdmin: true }, { merge: true }));
    // Zeroing a quota counter would buy unlimited embedding passes.
    await assertFails(setDoc(doc(db, "users", OWNER), { indexUsage: 0 }, { merge: true }));
  });

  it("refuses reading another user's document", async () => {
    await assertFails(getDoc(doc(as(STRANGER), "users", OWNER)));
  });
});

describe("rate limit counters", () => {
  it("allows a monotonic bump on your own bucket but not a reset", async () => {
    const id = `${OWNER}_2026-08-16`;
    const db = as(OWNER);
    await assertSucceeds(setDoc(doc(db, "userActivity", id), { userId: OWNER, messageCount: 1 }));
    await assertSucceeds(
      setDoc(doc(db, "userActivity", id), { userId: OWNER, messageCount: 2 }, { merge: true }),
    );
    await assertFails(
      setDoc(doc(db, "userActivity", id), { userId: OWNER, messageCount: 0 }, { merge: true }),
    );
  });

  it("refuses writing to someone else's bucket", async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), "userActivity", `${OWNER}_2026-08-16`), {
        userId: OWNER,
        messageCount: 1,
      }),
    );
  });
});

describe("MCP access requests", () => {
  it("lets a user request access for themselves and nobody else", async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), "mcpAccess", OWNER), {
        status: "requested",
        requestedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as(STRANGER), "mcpAccess", OWNER), {
        status: "requested",
        requestedAt: serverTimestamp(),
      }),
    );
  });

  it("refuses a self-granted status", async () => {
    await assertFails(
      setDoc(doc(as(OWNER), "mcpAccess", OWNER), {
        status: "granted",
        requestedAt: serverTimestamp(),
      }),
    );
  });
});

describe("collections that moved to story-data", () => {
  // Default-deny does the work; these assert nothing has quietly re-opened a
  // path that story-data now owns.
  const denied: [string, string[]][] = [
    ["a story document", ["stories", STORY]],
    ["a chapter", ["stories", STORY, "chapters", "c1"]],
    ["a chapter comment", ["stories", STORY, "chapters", "c1", "comments", "x"]],
    ["a character", ["stories", STORY, "characters", "x"]],
    ["a competition", ["competitions", "x"]],
    ["a guestbook entry", ["users", OWNER, "guestbook", "x"]],
    ["a public profile", ["publicProfiles", OWNER]],
    ["a token account", ["tokenAccounts", `user:${OWNER}`]],
    ["a ledger transfer", ["ledgerTransfers", "t1"]],
  ];

  for (const [label, path] of denied) {
    it(`refuses a client writing ${label}`, async () => {
      const [collection, ...rest] = path;
      await assertFails(
        setDoc(doc(as(OWNER), collection, ...rest), { anything: true }),
      );
    });
  }

  it("refuses a client deleting a book club record", async () => {
    await assertFails(deleteDoc(doc(as(OWNER), "bookClubs", "club-1")));
  });
});
