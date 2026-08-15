/**
 * Firestore rules tests for per-user guestbooks.
 *
 * The delete matrix is the reason this file exists: four principals (entry
 * author, guestbook owner, voter, stranger) across three document types, and
 * getting one wrong is either silent data loss or an entry nobody can remove.
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
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

const OWNER = "user_owner";
const AUTHOR = "user_author";
const STRANGER = "user_stranger";
const ENTRY_ID = "entry_1";
const REPLY_ID = "reply_1";

const entryPath = ["users", OWNER, "guestbook", ENTRY_ID] as const;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "guestbook-rules-test",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed as the Admin SDK would, bypassing rules.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, ...entryPath), {
      id: ENTRY_ID,
      ownerId: OWNER,
      authorId: AUTHOR,
      authorUsername: "author",
      content: "Signed your guestbook.",
      createdAt: new Date(),
      commentCount: 1,
      upvoteCount: 3,
      downvoteCount: 0,
    });
    await setDoc(doc(db, ...entryPath, "replies", REPLY_ID), {
      id: REPLY_ID,
      entryId: ENTRY_ID,
      authorId: STRANGER,
      authorUsername: "stranger",
      content: "Agreed.",
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      upvoteCount: 0,
      downvoteCount: 0,
    });
    await setDoc(doc(db, ...entryPath, "votes", STRANGER), {
      userId: STRANGER,
      voteType: "up",
      timestamp: new Date(),
    });
  });
});

const authed = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

const newEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry_new",
  ownerId: OWNER,
  authorId: STRANGER,
  authorUsername: "stranger",
  content: "Nice page.",
  createdAt: new Date(),
  commentCount: 0,
  upvoteCount: 0,
  downvoteCount: 0,
  ...overrides,
});

describe("guestbook reads", () => {
  it("is world-readable even though the parent user doc is not", async () => {
    await assertSucceeds(getDoc(doc(anon(), ...entryPath)));
    await assertSucceeds(getDocs(collection(anon(), "users", OWNER, "guestbook")));
    // The parent doc itself stays private — subcollection rules do not inherit.
    await assertFails(getDoc(doc(authed(STRANGER), "users", OWNER)));
  });

  it("exposes replies and votes to anyone", async () => {
    await assertSucceeds(getDoc(doc(anon(), ...entryPath, "replies", REPLY_ID)));
    await assertSucceeds(getDoc(doc(anon(), ...entryPath, "votes", STRANGER)));
  });
});

describe("signing a guestbook", () => {
  it("lets any signed-in user sign anyone's guestbook", async () => {
    await assertSucceeds(
      setDoc(doc(authed(STRANGER), "users", OWNER, "guestbook", "entry_new"), newEntry()),
    );
  });

  it("rejects a signed-out write", async () => {
    await assertFails(
      setDoc(doc(anon(), "users", OWNER, "guestbook", "entry_new"), newEntry()),
    );
  });

  it("rejects an entry attributed to someone else", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "users", OWNER, "guestbook", "entry_new"),
        newEntry({ authorId: AUTHOR }),
      ),
    );
  });

  it("rejects an ownerId that disagrees with the path", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "users", OWNER, "guestbook", "entry_new"),
        newEntry({ ownerId: STRANGER }),
      ),
    );
  });

  it("rejects an entry that arrives pre-loaded with votes", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "users", OWNER, "guestbook", "entry_new"),
        newEntry({ upvoteCount: 500 }),
      ),
    );
  });

  it("rejects empty content", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "users", OWNER, "guestbook", "entry_new"),
        newEntry({ content: "" }),
      ),
    );
  });
});

describe("deleting an entry", () => {
  it("lets the guestbook owner remove someone else's entry", async () => {
    await assertSucceeds(deleteDoc(doc(authed(OWNER), ...entryPath)));
  });

  it("lets the entry author remove their own entry", async () => {
    await assertSucceeds(deleteDoc(doc(authed(AUTHOR), ...entryPath)));
  });

  it("denies a third party", async () => {
    await assertFails(deleteDoc(doc(authed(STRANGER), ...entryPath)));
  });

  it("denies a signed-out caller", async () => {
    await assertFails(deleteDoc(doc(anon(), ...entryPath)));
  });

  it("lets the owner and entry author clear child docs during a cascade", async () => {
    await assertSucceeds(
      deleteDoc(doc(authed(OWNER), ...entryPath, "replies", REPLY_ID)),
    );
    await assertSucceeds(
      deleteDoc(doc(authed(AUTHOR), ...entryPath, "votes", STRANGER)),
    );
  });

  it("denies a third party clearing someone else's reply", async () => {
    await assertFails(
      deleteDoc(doc(authed("user_nobody"), ...entryPath, "replies", REPLY_ID)),
    );
  });
});

describe("vote counters", () => {
  it("allows a bounded single-step change", async () => {
    await assertSucceeds(
      updateDoc(doc(authed(STRANGER), ...entryPath), { upvoteCount: 4 }),
    );
  });

  it("rejects a jump larger than one", async () => {
    await assertFails(
      updateDoc(doc(authed(STRANGER), ...entryPath), { upvoteCount: 99 }),
    );
  });

  it("rejects a negative counter", async () => {
    await assertFails(
      updateDoc(doc(authed(STRANGER), ...entryPath), {
        upvoteCount: 3,
        downvoteCount: -1,
      }),
    );
  });

  it("rejects smuggling content alongside a counter bump", async () => {
    await assertFails(
      updateDoc(doc(authed(STRANGER), ...entryPath), {
        upvoteCount: 4,
        content: "hijacked",
      }),
    );
  });

  it("only accepts a vote doc keyed by the caller", async () => {
    await assertSucceeds(
      setDoc(doc(authed(AUTHOR), ...entryPath, "votes", AUTHOR), {
        userId: AUTHOR,
        voteType: "up",
        timestamp: new Date(),
      }),
    );
    await assertFails(
      setDoc(doc(authed(AUTHOR), ...entryPath, "votes", STRANGER), {
        userId: STRANGER,
        voteType: "up",
        timestamp: new Date(),
      }),
    );
  });

  it("rejects a vote type outside up/down", async () => {
    await assertFails(
      setDoc(doc(authed(AUTHOR), ...entryPath, "votes", AUTHOR), {
        userId: AUTHOR,
        voteType: "sideways",
        timestamp: new Date(),
      }),
    );
  });
});

describe("editing an entry", () => {
  it("lets the author edit their own content", async () => {
    await assertSucceeds(
      updateDoc(doc(authed(AUTHOR), ...entryPath), {
        content: "Edited.",
        updatedAt: new Date(),
      }),
    );
  });

  it("denies the guestbook owner rewriting someone else's words", async () => {
    // The owner can delete the entry, but not put words in the author's mouth.
    await assertFails(
      updateDoc(doc(authed(OWNER), ...entryPath), { content: "Rewritten." }),
    );
  });

  it("denies reassigning authorship", async () => {
    await assertFails(
      updateDoc(doc(authed(AUTHOR), ...entryPath), { authorId: STRANGER }),
    );
  });
});

describe("reply counter", () => {
  it("allows a single-step increase", async () => {
    await assertSucceeds(
      updateDoc(doc(authed(STRANGER), ...entryPath), { commentCount: 2 }),
    );
  });

  it("rejects an increase larger than one", async () => {
    await assertFails(
      updateDoc(doc(authed(STRANGER), ...entryPath), { commentCount: 9 }),
    );
  });

  it("allows a multi-step decrease, since deleting a reply takes its subtree", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), ...entryPath), {
        commentCount: 5,
      });
    });
    await assertSucceeds(
      updateDoc(doc(authed(STRANGER), ...entryPath), { commentCount: 1 }),
    );
  });
});
