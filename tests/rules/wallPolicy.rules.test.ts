/**
 * Firestore rules tests for guestbook wall policies and the people directory.
 *
 * The policy matrix is the reason this file exists: five settings across five
 * principals, on both entries and replies. Getting a cell wrong is either a wall
 * that stays open after its owner closed it, or one nobody can sign.
 *
 * The defaulting cases matter as much as the matrix. `mayPostOnWall()` reads a
 * field that most documents do not have, on documents that may not exist at all,
 * and rules `get()` on a missing document errors rather than returning a default
 * — so "no profile", "no field" and "no user doc" each need their own test.
 * KEEP IN SYNC with tests/guestbookPolicy.test.ts, which asserts the client-side
 * gate agrees cell for cell.
 *
 * Requires a running Firestore emulator:
 *
 *     firebase emulators:start --only firestore
 *     yarn test:rules
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
  collection,
  doc,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAt,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

const OWNER = "user_owner";
/** Follows the owner, and is therefore in OWNER.followers. */
const FOLLOWER = "user_follower";
/** Followed by the owner, and is therefore in OWNER.following. */
const FOLLOWED = "user_followed";
/** In both arrays. */
const MUTUAL = "user_mutual";
const STRANGER = "user_stranger";

const ENTRY_ID = "entry_1";
const entryPath = ["users", OWNER, "guestbook", ENTRY_ID] as const;

type Policy = "nobody" | "following" | "mutuals" | "followers" | "everyone";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "wall-policy-rules-test",
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
    await setDoc(doc(db, "users", OWNER), {
      username: "owner",
      followers: [FOLLOWER, MUTUAL],
      following: [FOLLOWED, MUTUAL],
    });
    await setDoc(doc(db, "publicProfiles", OWNER), {
      username: "owner",
      usernameLower: "owner",
      updatedAt: new Date().toISOString(),
    });
    // An existing entry, so replies have somewhere to land.
    await setDoc(doc(db, ...entryPath), {
      id: ENTRY_ID,
      ownerId: OWNER,
      authorId: OWNER,
      authorUsername: "owner",
      content: "First.",
      createdAt: new Date(),
      commentCount: 0,
      upvoteCount: 0,
      downvoteCount: 0,
    });
  });
});

const authed = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

const setPolicy = async (policy: Policy | null) =>
  testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "publicProfiles", OWNER),
      {
        username: "owner",
        usernameLower: "owner",
        updatedAt: new Date().toISOString(),
        ...(policy ? { guestbookPolicy: policy } : {}),
      },
      { merge: false },
    );
  });

const signAs = (uid: string) =>
  setDoc(doc(authed(uid), "users", OWNER, "guestbook", `entry_${uid}`), {
    id: `entry_${uid}`,
    ownerId: OWNER,
    authorId: uid,
    authorUsername: uid,
    content: "Hello.",
    createdAt: new Date(),
    commentCount: 0,
    upvoteCount: 0,
    downvoteCount: 0,
  });

const replyAs = (uid: string) =>
  setDoc(doc(authed(uid), ...entryPath, "replies", `reply_${uid}`), {
    id: `reply_${uid}`,
    entryId: ENTRY_ID,
    authorId: uid,
    authorUsername: uid,
    content: "Agreed.",
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    upvoteCount: 0,
    downvoteCount: 0,
  });

/**
 * Expected outcome per policy. The owner column is deliberately all-true: an
 * owner must never be locked out of their own page.
 */
const MATRIX: Record<Policy, Record<string, boolean>> = {
  everyone: {
    [OWNER]: true,
    [FOLLOWER]: true,
    [FOLLOWED]: true,
    [MUTUAL]: true,
    [STRANGER]: true,
  },
  followers: {
    [OWNER]: true,
    [FOLLOWER]: true,
    [FOLLOWED]: false,
    [MUTUAL]: true,
    [STRANGER]: false,
  },
  following: {
    [OWNER]: true,
    [FOLLOWER]: false,
    [FOLLOWED]: true,
    [MUTUAL]: true,
    [STRANGER]: false,
  },
  mutuals: {
    [OWNER]: true,
    [FOLLOWER]: false,
    [FOLLOWED]: false,
    [MUTUAL]: true,
    [STRANGER]: false,
  },
  nobody: {
    [OWNER]: true,
    [FOLLOWER]: false,
    [FOLLOWED]: false,
    [MUTUAL]: false,
    [STRANGER]: false,
  },
};

const PRINCIPAL_NAMES: Record<string, string> = {
  [OWNER]: "the owner",
  [FOLLOWER]: "a follower",
  [FOLLOWED]: "someone the owner follows",
  [MUTUAL]: "a mutual follow",
  [STRANGER]: "a stranger",
};

describe("wall policy matrix", () => {
  (Object.keys(MATRIX) as Policy[]).forEach((policy) => {
    describe(`policy "${policy}"`, () => {
      Object.entries(MATRIX[policy]).forEach(([uid, allowed]) => {
        const who = PRINCIPAL_NAMES[uid];
        const verb = allowed ? "lets" : "stops";

        it(`${verb} ${who} sign an entry`, async () => {
          await setPolicy(policy);
          await (allowed ? assertSucceeds : assertFails)(signAs(uid));
        });

        it(`${verb} ${who} post a reply`, async () => {
          await setPolicy(policy);
          await (allowed ? assertSucceeds : assertFails)(replyAs(uid));
        });
      });
    });
  });
});

describe("policy defaulting", () => {
  it("treats a missing guestbookPolicy field as everyone", async () => {
    await setPolicy(null);
    await assertSucceeds(signAs(STRANGER));
  });

  it("treats a missing publicProfiles doc as everyone", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "publicProfiles", OWNER), {}, { merge: false });
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(context.firestore(), "publicProfiles", OWNER));
    });
    await assertSucceeds(signAs(STRANGER));
  });

  // The owner doc is what wallRelationAllows() reads. An unguarded get() here
  // would deny every signing on an account whose user doc is missing.
  it("treats a missing users doc as everyone", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(context.firestore(), "users", OWNER));
    });
    await setPolicy(null);
    await assertSucceeds(signAs(STRANGER));
  });

  // A value outside the union is not 'everyone' and matches no relation branch,
  // so it fails closed for everyone but the owner.
  it("denies a stranger when the stored policy is unrecognised", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "publicProfiles", OWNER),
        {
          username: "owner",
          usernameLower: "owner",
          updatedAt: new Date().toISOString(),
          guestbookPolicy: "banana",
        },
        { merge: false },
      );
    });
    await assertFails(signAs(STRANGER));
    await assertSucceeds(signAs(OWNER));
  });
});

describe("what the policy does not gate", () => {
  beforeEach(async () => {
    await setPolicy("nobody");
  });

  it("still lets a stranger vote on an existing entry", async () => {
    await assertSucceeds(
      setDoc(doc(authed(STRANGER), ...entryPath, "votes", STRANGER), {
        userId: STRANGER,
        voteType: "up",
        timestamp: new Date(),
      }),
    );
  });

  // The reply create fails first, so the bump needs no gate of its own.
  it("still allows a bounded commentCount bump", async () => {
    await assertSucceeds(
      updateDoc(doc(authed(STRANGER), ...entryPath), { commentCount: 1 }),
    );
  });

  it("still lets the owner delete a stranger's entry", async () => {
    await setPolicy("everyone");
    await signAs(STRANGER);
    const { deleteDoc } = await import("firebase/firestore");
    await assertSucceeds(
      deleteDoc(
        doc(authed(OWNER), "users", OWNER, "guestbook", `entry_${STRANGER}`),
      ),
    );
  });
});

describe("the people directory", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "publicProfiles", FOLLOWER), {
        username: "Alice",
        usernameLower: "alice",
        bio: "Poet",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "publicProfiles", STRANGER), {
        username: "Bob",
        usernameLower: "bob",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  });

  const directory = (db: ReturnType<typeof anon>, max: number) =>
    getDocs(
      query(collection(db, "publicProfiles"), orderBy("usernameLower"), limit(max)),
    );

  it("is listable by a signed-in member", async () => {
    await assertSucceeds(directory(authed(STRANGER), 20));
  });

  it("is not listable signed out", async () => {
    await assertFails(directory(anon(), 20));
  });

  it("rejects a page larger than the cap", async () => {
    await assertFails(directory(authed(STRANGER), 50));
  });

  it("allows a username prefix range query", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(authed(STRANGER), "publicProfiles"),
          orderBy("usernameLower"),
          startAt("al"),
          endAt("al"),
          limit(20),
        ),
      ),
    );
  });
});

describe("profile writes", () => {
  const validProfile = (overrides: Record<string, unknown> = {}) => ({
    username: "Stranger",
    usernameLower: "stranger",
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it("lets a user create their own profile", async () => {
    await assertSucceeds(
      setDoc(doc(authed(STRANGER), "publicProfiles", STRANGER), validProfile()),
    );
  });

  it("rejects a usernameLower that disagrees with the username", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "publicProfiles", STRANGER),
        validProfile({ usernameLower: "someone-else" }),
      ),
    );
  });

  it("rejects a policy value outside the union", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "publicProfiles", STRANGER),
        validProfile({ guestbookPolicy: "banana" }),
      ),
    );
  });

  it("accepts every valid policy value", async () => {
    for (const policy of [
      "nobody",
      "following",
      "mutuals",
      "followers",
      "everyone",
    ]) {
      await assertSucceeds(
        setDoc(
          doc(authed(STRANGER), "publicProfiles", STRANGER),
          validProfile({ guestbookPolicy: policy }),
        ),
      );
    }
  });

  it("rejects writing someone else's profile", async () => {
    await assertFails(
      setDoc(doc(authed(STRANGER), "publicProfiles", OWNER), validProfile()),
    );
  });

  // The regression this fixes: an old backfill wrote a displayName that was
  // never in the allowed key set, and because profile writes are merges, the
  // whole-document hasOnly() check locked those owners out permanently.
  it("lets an owner update a profile carrying a stray displayName", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "publicProfiles", STRANGER), {
        username: "Stranger",
        usernameLower: "stranger",
        displayName: "Legacy Name",
        updatedAt: new Date().toISOString(),
      });
    });

    await assertSucceeds(
      setDoc(
        doc(authed(STRANGER), "publicProfiles", STRANGER),
        { bio: "Updated.", updatedAt: new Date().toISOString() },
        { merge: true },
      ),
    );
  });

  it("still rejects a client writing an unknown field", async () => {
    await assertFails(
      setDoc(
        doc(authed(STRANGER), "publicProfiles", STRANGER),
        validProfile({ followerCount: 999 }),
      ),
    );
  });
});
