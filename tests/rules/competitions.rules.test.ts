/**
 * Firestore rules tests for competitions and the TALE ledger.
 *
 * These rules are what guard prize money, so they get real tests rather than a
 * checklist. Requires a running Firestore emulator:
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
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

const OWNER = "user_owner";
const OTHER = "user_other";
const COMPETITION_ID = "comp_1";
const DRAFT_ID = "comp_draft";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "story-rules-test",
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
    await setDoc(doc(db, "competitions", DRAFT_ID), {
      title: "Unpublished draft",
      creatorId: OWNER,
      phase: "draft",
      published: false,
      escrowState: "unfunded",
      createdAt: new Date(),
    });
    await setDoc(doc(db, "competitions", COMPETITION_ID), {
      title: "Seeded",
      creatorId: OWNER,
      phase: "open",
      published: true,
      createdAt: new Date(),
      escrowState: "funded",
      participantsCount: 0,
      prizePool: {
        assetId: "TALE",
        symbol: "TALE",
        decimals: 18,
        amount: "1000000000000000000000",
      },
    });
    await setDoc(
      doc(db, "competitions", COMPETITION_ID, "participants", OWNER),
      { userId: OWNER },
    );
    await setDoc(
      doc(db, "competitions", COMPETITION_ID, "contributions", OWNER),
      { userId: OWNER, amount: "25000000000000000000", state: "held" },
    );
    await setDoc(
      doc(db, "competitions", COMPETITION_ID, "contributions", OTHER),
      { userId: OTHER, amount: "25000000000000000000", state: "held" },
    );
    await setDoc(doc(db, "tokenAccounts", `user:${OWNER}`), {
      accountId: `user:${OWNER}`,
      ownerId: OWNER,
      kind: "user",
      assetId: "TALE",
      balance: "1000000000000000000000",
    });
    await setDoc(doc(db, "tokenAccounts", `escrow:competition:${COMPETITION_ID}`), {
      accountId: `escrow:competition:${COMPETITION_ID}`,
      kind: "escrow",
      assetId: "TALE",
      balance: "1000000000000000000000",
    });
    await setDoc(doc(db, "ledgerTransfers", "escrow:fund:competition:comp_1"), {
      assetId: "TALE",
      reason: "escrow:fund",
      accountIds: [`user:${OWNER}`, `escrow:competition:${COMPETITION_ID}`],
      postings: [],
    });
    await setDoc(doc(db, "users", OTHER), { username: "other" });

    await setDoc(
      doc(db, "competitions", COMPETITION_ID, "submissions", OWNER),
      { userId: OWNER, storyId: "story_1", status: "submitted" },
    );
    await setDoc(doc(db, "competitions", COMPETITION_ID, "votes", OWNER), {
      voterId: OWNER,
      submissionIds: ["someone_else"],
    });
    await setDoc(doc(db, "competitions", COMPETITION_ID, "private", "tally"), {
      counts: { [OWNER]: 7 },
      updatedAt: null,
    });
  });
});

const authed = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

describe("competitions", () => {
  it("is publicly readable once published", async () => {
    await assertSucceeds(getDoc(doc(anon(), "competitions", COMPETITION_ID)));
    await assertSucceeds(getDoc(doc(authed(OTHER), "competitions", COMPETITION_ID)));
  });

  // THE regression test: this is exactly what the old rules permitted.
  it("cannot be created by an authenticated non-admin user", async () => {
    await assertFails(
      setDoc(doc(authed(OTHER), "competitions", "forged"), {
        title: "Free money",
        creatorId: OTHER,
        prizePool: {
          assetId: "TALE",
          symbol: "TALE",
          decimals: 18,
          amount: "999999000000000000000000",
        },
      }),
    );
  });

  it("cannot be created even by the seeded creator", async () => {
    // Admin-ness is a custom claim checked in the endpoint, never in rules —
    // no client path may write this collection at all.
    await assertFails(
      setDoc(doc(authed(OWNER), "competitions", "forged2"), {
        title: "Mine",
        creatorId: OWNER,
      }),
    );
  });

  it("cannot be updated by its creator", async () => {
    await assertFails(
      updateDoc(doc(authed(OWNER), "competitions", COMPETITION_ID), {
        title: "Renamed",
      }),
    );
  });

  it("cannot have its prize pool rewritten", async () => {
    await assertFails(
      updateDoc(doc(authed(OWNER), "competitions", COMPETITION_ID), {
        prizePool: {
          assetId: "TALE",
          symbol: "TALE",
          decimals: 18,
          amount: "999999000000000000000000",
        },
      }),
    );
  });

  it("cannot have its participant count forged", async () => {
    await assertFails(
      updateDoc(doc(authed(OWNER), "competitions", COMPETITION_ID), {
        participantsCount: 9999,
      }),
    );
  });

  it("cannot have its phase advanced by a client", async () => {
    await assertFails(
      updateDoc(doc(authed(OWNER), "competitions", COMPETITION_ID), {
        phase: "settled",
      }),
    );
  });

  it("cannot be deleted, even by its creator", async () => {
    await assertFails(deleteDoc(doc(authed(OWNER), "competitions", COMPETITION_ID)));
  });

  it("hides an unpublished draft from everyone but its creator", async () => {
    await assertSucceeds(getDoc(doc(authed(OWNER), "competitions", DRAFT_ID)));
    await assertFails(getDoc(doc(authed(OTHER), "competitions", DRAFT_ID)));
    await assertFails(getDoc(doc(anon(), "competitions", DRAFT_ID)));
  });

  /**
   * Firestore rejects a whole list query if any document it would return fails
   * the rule, so the explore page MUST constrain on `published`. If this ever
   * starts passing, an unconstrained read is leaking drafts.
   */
  it("refuses an unconstrained list of the collection", async () => {
    await assertFails(getDocs(collection(anon(), "competitions")));
    await assertFails(getDocs(collection(authed(OTHER), "competitions")));
  });

  it("allows the two queries the app actually issues", async () => {
    // The public explore list.
    await assertSucceeds(
      getDocs(
        query(collection(anon(), "competitions"), where("published", "==", true)),
      ),
    );
    // A host's own drafts.
    await assertSucceeds(
      getDocs(
        query(
          collection(authed(OWNER), "competitions"),
          where("creatorId", "==", OWNER),
          where("published", "==", false),
        ),
      ),
    );
  });

  it("will not let one host list another's drafts", async () => {
    await assertFails(
      getDocs(
        query(
          collection(authed(OTHER), "competitions"),
          where("creatorId", "==", OWNER),
          where("published", "==", false),
        ),
      ),
    );
  });

  /**
   * A document that predates `published` must fail closed, not error. This is
   * why the rule uses `.get(field, default)` — reading an absent property is an
   * error in rules, which would have made such a document unreadable to its own
   * creator too. It also makes the migration a hard prerequisite for deploying.
   */
  it("hides a document the migration has not reached, without erroring", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "competitions", "unmigrated"), {
        title: "Pre-migration",
        creatorId: OWNER,
        phase: "open",
      });
    });

    await assertFails(getDoc(doc(anon(), "competitions", "unmigrated")));
    // Its creator can still reach it, so nothing is stranded.
    await assertSucceeds(getDoc(doc(authed(OWNER), "competitions", "unmigrated")));
  });

  it("keeps participants readable but not writable", async () => {
    await assertSucceeds(
      getDoc(doc(authed(OTHER), "competitions", COMPETITION_ID, "participants", OWNER)),
    );
    await assertFails(
      setDoc(
        doc(authed(OTHER), "competitions", COMPETITION_ID, "participants", OTHER),
        { userId: OTHER },
      ),
    );
  });
});

describe("contributions", () => {
  it("lets an entrant read what they paid", async () => {
    await assertSucceeds(
      getDoc(doc(authed(OWNER), "competitions", COMPETITION_ID, "contributions", OWNER)),
    );
  });

  it("hides what somebody else paid", async () => {
    await assertFails(
      getDoc(doc(authed(OTHER), "competitions", COMPETITION_ID, "contributions", OWNER)),
    );
  });

  /** Denying `get` is not enough — a list would expose the whole roster. */
  it("cannot be listed, even by the host", async () => {
    await assertFails(
      getDocs(collection(authed(OWNER), "competitions", COMPETITION_ID, "contributions")),
    );
    await assertFails(
      getDocs(collection(authed(OTHER), "competitions", COMPETITION_ID, "contributions")),
    );
  });

  it("is unreadable when signed out", async () => {
    await assertFails(
      getDoc(doc(anon(), "competitions", COMPETITION_ID, "contributions", OWNER)),
    );
  });

  it("cannot be forged, so nobody can claim to have paid", async () => {
    await assertFails(
      setDoc(doc(authed(OTHER), "competitions", COMPETITION_ID, "contributions", OTHER), {
        userId: OTHER,
        amount: "25000000000000000000",
        state: "held",
      }),
    );
  });

  /** A writable `state` would let an entrant claim a refund they never got. */
  it("cannot be edited by the entrant it belongs to", async () => {
    await assertFails(
      updateDoc(
        doc(authed(OWNER), "competitions", COMPETITION_ID, "contributions", OWNER),
        { state: "refunded" },
      ),
    );
    await assertFails(
      updateDoc(
        doc(authed(OWNER), "competitions", COMPETITION_ID, "contributions", OWNER),
        { amount: "999000000000000000000" },
      ),
    );
  });

  it("cannot be deleted to erase the record of a payment", async () => {
    await assertFails(
      deleteDoc(doc(authed(OWNER), "competitions", COMPETITION_ID, "contributions", OWNER)),
    );
  });
});

describe("submissions", () => {
  it("is a public gallery", async () => {
    await assertSucceeds(
      getDoc(doc(anon(), "competitions", COMPETITION_ID, "submissions", OWNER)),
    );
    await assertSucceeds(
      getDocs(collection(authed(OTHER), "competitions", COMPETITION_ID, "submissions")),
    );
  });

  it("cannot be forged by entering yourself", async () => {
    await assertFails(
      setDoc(
        doc(authed(OTHER), "competitions", COMPETITION_ID, "submissions", OTHER),
        { userId: OTHER, storyId: "not_mine", status: "submitted" },
      ),
    );
  });

  it("cannot be tampered with by another entrant", async () => {
    await assertFails(
      updateDoc(
        doc(authed(OTHER), "competitions", COMPETITION_ID, "submissions", OWNER),
        { status: "withdrawn" },
      ),
    );
  });

  it("cannot have a vote count injected", async () => {
    // voteCount only ever appears at settlement, written by the server.
    await assertFails(
      updateDoc(
        doc(authed(OWNER), "competitions", COMPETITION_ID, "submissions", OWNER),
        { voteCount: 9999 },
      ),
    );
  });
});

describe("votes", () => {
  it("lets a voter read back their own ballot", async () => {
    await assertSucceeds(
      getDoc(doc(authed(OWNER), "competitions", COMPETITION_ID, "votes", OWNER)),
    );
  });

  it("hides another user's ballot", async () => {
    await assertFails(
      getDoc(doc(authed(OTHER), "competitions", COMPETITION_ID, "votes", OWNER)),
    );
  });

  // The subtle one: listing the subcollection reconstructs the live standings
  // that the voting phase exists to hide, without reading any single forbidden
  // document. Denying `get` alone would not be enough.
  it("refuses to list ballots, which would reconstruct the tally", async () => {
    await assertFails(
      getDocs(collection(authed(OWNER), "competitions", COMPETITION_ID, "votes")),
    );
    await assertFails(
      getDocs(collection(anon(), "competitions", COMPETITION_ID, "votes")),
    );
  });

  it("cannot be written directly, even for yourself", async () => {
    await assertFails(
      setDoc(
        doc(authed(OTHER), "competitions", COMPETITION_ID, "votes", OTHER),
        { voterId: OTHER, submissionIds: [OTHER, OTHER, OTHER] },
      ),
    );
  });
});

describe("competitionJoins", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", OWNER, "competitionJoins", COMPETITION_ID),
        { competitionId: COMPETITION_ID },
      );
    });
  });

  // The competition detail page reads this to decide whether to offer the
  // entry action, so an owner MUST be able to read their own join doc.
  it("lets a user read their own join record", async () => {
    await assertSucceeds(
      getDoc(doc(authed(OWNER), "users", OWNER, "competitionJoins", COMPETITION_ID)),
    );
  });

  it("hides another user's join record", async () => {
    await assertFails(
      getDoc(doc(authed(OTHER), "users", OWNER, "competitionJoins", COMPETITION_ID)),
    );
  });

  it("cannot be forged — joining goes through the Cloud Function", async () => {
    await assertFails(
      setDoc(
        doc(authed(OTHER), "users", OTHER, "competitionJoins", COMPETITION_ID),
        { competitionId: COMPETITION_ID },
      ),
    );
  });
});

describe("settled results", () => {
  const SETTLED_ID = "comp_settled";

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "competitions", SETTLED_ID), {
        title: "Settled",
        creatorId: OWNER,
        phase: "settled",
        published: true,
        escrowState: "released",
        results: [
          {
            rank: 1,
            userId: OTHER,
            submissionId: OTHER,
            votes: 4,
            amount: "1000000000000000000000",
          },
        ],
        resultsDigest: "abc123def456",
        resultsDigestPayload: { v: 1, competitionId: SETTLED_ID },
      });
      await setDoc(
        doc(db, "competitions", SETTLED_ID, "submissions", OTHER),
        { userId: OTHER, status: "submitted", voteCount: 4, finalRank: 1 },
      );
      await setDoc(doc(db, "competitions", SETTLED_ID, "private", "tally"), {
        counts: { [OTHER]: 4 },
      });
    });
  });

  it("publishes results and the digest to everyone", async () => {
    // The digest is only meaningful if anyone can fetch it and recompute.
    await assertSucceeds(getDoc(doc(anon(), "competitions", SETTLED_ID)));
    await assertSucceeds(getDoc(doc(authed(OTHER), "competitions", SETTLED_ID)));
  });

  it("still refuses client writes to a settled competition", async () => {
    await assertFails(
      updateDoc(doc(authed(OWNER), "competitions", SETTLED_ID), {
        results: [{ rank: 1, userId: OWNER, amount: "999" }],
      }),
    );
    await assertFails(
      updateDoc(doc(authed(OWNER), "competitions", SETTLED_ID), {
        resultsDigest: "forged",
      }),
    );
  });

  it("keeps the tally private even AFTER settlement", async () => {
    // Results are public; the ballot-level tally never becomes readable.
    await assertFails(
      getDoc(doc(authed(OWNER), "competitions", SETTLED_ID, "private", "tally")),
    );
    await assertFails(
      getDoc(doc(anon(), "competitions", SETTLED_ID, "private", "tally")),
    );
  });

  it("exposes the published voteCount but still refuses to let a client change it", async () => {
    await assertSucceeds(
      getDoc(doc(anon(), "competitions", SETTLED_ID, "submissions", OTHER)),
    );
    await assertFails(
      updateDoc(
        doc(authed(OTHER), "competitions", SETTLED_ID, "submissions", OTHER),
        { voteCount: 9999 },
      ),
    );
  });
});

describe("private tally", () => {
  it("is unreadable to everyone — this is what hides live standings", async () => {
    await assertFails(
      getDoc(doc(authed(OWNER), "competitions", COMPETITION_ID, "private", "tally")),
    );
    await assertFails(
      getDoc(doc(anon(), "competitions", COMPETITION_ID, "private", "tally")),
    );
    await assertFails(
      getDocs(collection(authed(OWNER), "competitions", COMPETITION_ID, "private")),
    );
  });

  it("cannot be written", async () => {
    await assertFails(
      updateDoc(
        doc(authed(OWNER), "competitions", COMPETITION_ID, "private", "tally"),
        { counts: { [OWNER]: 99999 } },
      ),
    );
  });
});

describe("tokenAccounts", () => {
  it("lets an owner read their own balance", async () => {
    await assertSucceeds(getDoc(doc(authed(OWNER), "tokenAccounts", `user:${OWNER}`)));
  });

  it("hides another user's balance", async () => {
    await assertFails(getDoc(doc(authed(OTHER), "tokenAccounts", `user:${OWNER}`)));
  });

  it("hides balances from anonymous readers", async () => {
    await assertFails(getDoc(doc(anon(), "tokenAccounts", `user:${OWNER}`)));
  });

  it("refuses enumeration, which would expose every balance", async () => {
    await assertFails(getDocs(collection(authed(OWNER), "tokenAccounts")));
  });

  it("refuses a self-write — a writable balance is a mint", async () => {
    await assertFails(
      updateDoc(doc(authed(OWNER), "tokenAccounts", `user:${OWNER}`), {
        balance: "999999000000000000000000",
      }),
    );
  });

  it("refuses creating an account for yourself", async () => {
    await assertFails(
      setDoc(doc(authed(OTHER), "tokenAccounts", `user:${OTHER}`), {
        accountId: `user:${OTHER}`,
        ownerId: OTHER,
        balance: "500000000000000000000",
      }),
    );
  });

  it("refuses draining an escrow account", async () => {
    await assertFails(
      updateDoc(
        doc(authed(OWNER), "tokenAccounts", `escrow:competition:${COMPETITION_ID}`),
        { balance: "0" },
      ),
    );
  });
});

describe("ledgerTransfers", () => {
  it("is unreadable to clients — postings name both counterparties", async () => {
    await assertFails(
      getDoc(doc(authed(OWNER), "ledgerTransfers", "escrow:fund:competition:comp_1")),
    );
    await assertFails(getDocs(collection(authed(OWNER), "ledgerTransfers")));
  });

  it("cannot be forged", async () => {
    await assertFails(
      setDoc(doc(authed(OTHER), "ledgerTransfers", "grant:admin:user_other:x"), {
        assetId: "TALE",
        reason: "grant:admin",
        postings: [
          { accountId: "system:mint", delta: "-1000" },
          { accountId: `user:${OTHER}`, delta: "1000" },
        ],
      }),
    );
  });
});

describe("faucet counters", () => {
  it("refuses a user resetting their own faucet cooldown", async () => {
    await assertFails(
      updateDoc(doc(authed(OTHER), "users", OTHER), {
        faucetUsage: 0,
        lastFaucetDate: "1970-01-01",
      }),
    );
  });
});
