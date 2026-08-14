/**
 * Double-entry ledger for the platform token (TALE).
 *
 * Shape and the reasoning behind it:
 *
 * - **One document per transfer, with postings embedded.** A transfer holds an
 *   array of `{accountId, delta}` that must sum to exactly zero. Writing both
 *   sides of a movement as one document makes balance conservation atomic by
 *   construction, and lets a single transfer express an N-way payout split
 *   (escrow -> three winners) that a row-per-entry table could not write
 *   atomically.
 *
 * - **The idempotency key IS the document id, and it is written with
 *   `transaction.create`.** A replay therefore fails with ALREADY_EXISTS at the
 *   database rather than relying on application code to notice. Keys are always
 *   derived server-side (see the callers): a client-supplied key is both a
 *   double-spend vector (fresh key replays a debit) and a silent-no-op vector
 *   (reused key swallows a different transfer).
 *
 * - **`tokenAccounts` is a projection, not the truth.** Balances are
 *   materialized so a read is one document, but they are only ever written in
 *   the same transaction as the transfer that moves them, so they can be
 *   rebuilt by replaying `ledgerTransfers`.
 *
 * - **`system:*` accounts get no `tokenAccounts` document.** The mint is an
 *   unbounded source; giving it a materialized balance would make it the single
 *   hottest document in the system, precisely where `FieldValue.increment` is
 *   unusable (18-decimal minor units exceed float64, so every balance write is a
 *   read-modify-write). Issued supply is derived by aggregating postings
 *   offline instead.
 *
 * `db` is passed in explicitly rather than captured at module scope — matching
 * jobService.ts — so this module can be driven directly by an emulator-backed
 * script with no functions framework.
 */
import { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  MinorUnits,
  TALE_ASSET_ID,
  ZERO,
  isMinorUnits,
  toMinorUnits,
  wholeToMinorUnits,
} from "./money";

export const LEDGER_TRANSFERS = "ledgerTransfers";
export const TOKEN_ACCOUNTS = "tokenAccounts";

export type AccountId = string;

export const userAccount = (uid: string): AccountId => `user:${uid}`;
export const escrowAccount = (competitionId: string): AccountId =>
  `escrow:competition:${competitionId}`;
export const MINT_ACCOUNT: AccountId = "system:mint";

/**
 * Where the platform's cut of entry fees lands. Deliberately not a `system:`
 * id — those are excluded from materialization below and so carry no balance
 * document, which is right for the mint and wrong for a treasury we want to
 * read. On-chain, `owner()`.
 */
export const PLATFORM_ACCOUNT: AccountId = "platform:treasury";

const isSystemAccount = (accountId: AccountId): boolean =>
  accountId.startsWith("system:");

export type LedgerReason =
  | "grant:initial"
  | "grant:faucet"
  | "grant:admin"
  | "escrow:fund"
  | "escrow:release"
  | "escrow:refund"
  /** An entrant's fee moving into escrow. */
  | "escrow:entry"
  /** An entrant's fee coming back out on withdrawal or cancellation. */
  | "escrow:entry-refund"
  /** Entry fees splitting to the platform and host at settlement. */
  | "escrow:fee";

export interface Posting {
  accountId: AccountId;
  /** Signed. Negative debits, positive credits. All postings must sum to 0n. */
  delta: bigint;
}

export interface TransferParams {
  /** Server-derived. Becomes the document id, so it must be stable per operation. */
  idempotencyKey: string;
  reason: LedgerReason;
  postings: Posting[];
  assetId?: string;
  competitionId?: string;
  metadata?: Record<string, string>;
}

export interface TransferResult {
  transferId: string;
  /** True when this key had already been applied — the call was a no-op. */
  alreadyApplied: boolean;
}

/** Free TALE materialized on a user's first balance read or spend. */
export function getInitialGrantAmount(): MinorUnits {
  const parsed = Number.parseInt(process.env.INITIAL_TALE_GRANT || "1000", 10);
  return wholeToMinorUnits(Number.isNaN(parsed) || parsed < 0 ? 1000 : parsed);
}

/** TALE handed out per successful faucet claim. */
export function getFaucetGrantAmount(): MinorUnits {
  const parsed = Number.parseInt(process.env.FAUCET_TALE_GRANT || "250", 10);
  return wholeToMinorUnits(Number.isNaN(parsed) || parsed <= 0 ? 250 : parsed);
}

const transferRef = (db: Firestore, idempotencyKey: string) =>
  db.collection(LEDGER_TRANSFERS).doc(idempotencyKey);

const accountRef = (db: Firestore, accountId: AccountId) =>
  db.collection(TOKEN_ACCOUNTS).doc(accountId);

const readBalance = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): MinorUnits => {
  const raw = snapshot.data()?.balance;
  return isMinorUnits(raw) ? raw : ZERO;
};

const accountKind = (accountId: AccountId): "user" | "escrow" | "platform" => {
  if (accountId.startsWith("escrow:")) return "escrow";
  if (accountId.startsWith("platform:")) return "platform";
  return "user";
};

const ownerIdOf = (accountId: AccountId): string | null =>
  accountId.startsWith("user:") ? accountId.slice("user:".length) : null;

/**
 * Apply a balanced set of postings exactly once.
 *
 * Returns `{alreadyApplied: true}` when the key has already been used — callers
 * must treat that as success, not as an error, so that retries are safe.
 */
export async function transfer(
  db: Firestore,
  params: TransferParams,
): Promise<TransferResult> {
  const { idempotencyKey, reason, postings } = params;
  const assetId = params.assetId ?? TALE_ASSET_ID;

  if (!idempotencyKey) {
    throw new Error("transfer: idempotencyKey is required");
  }
  if (postings.length < 2) {
    throw new Error("transfer: at least two postings are required");
  }

  const sum = postings.reduce((acc, posting) => acc + posting.delta, 0n);
  if (sum !== 0n) {
    // A non-zero sum would mint or burn tokens silently. Refuse loudly — this
    // is a programming error, never a user-input error.
    throw new Error(
      `transfer: postings must sum to zero (got ${sum.toString()} for ${idempotencyKey})`,
    );
  }
  if (postings.some((posting) => posting.delta === 0n)) {
    throw new Error("transfer: postings cannot contain a zero delta");
  }

  const accountIds = postings.map((posting) => posting.accountId);
  if (new Set(accountIds).size !== accountIds.length) {
    throw new Error("transfer: an account may appear at most once per transfer");
  }

  const ledgerRef = transferRef(db, idempotencyKey);
  const materialized = postings.filter(
    (posting) => !isSystemAccount(posting.accountId),
  );

  // Materialize the free starting balance before anyone spends from it.
  // Doing this here rather than only in getBalance means EVERY spend path is
  // covered — a user's first action might be funding a competition, not
  // checking their balance, and they must not be told they have nothing.
  //
  // This cannot recurse: the grant's own postings credit the user (positive)
  // and debit `system:mint`, so neither qualifies below.
  for (const posting of postings) {
    if (posting.delta < 0n) {
      const ownerId = ownerIdOf(posting.accountId);
      if (ownerId) await ensureInitialGrant(db, ownerId);
    }
  }

  try {
    return await db.runTransaction(async (tx) => {
      // Firestore requires every read before any write.
      const [ledgerSnapshot, ...accountSnapshots] = await Promise.all([
        tx.get(ledgerRef),
        ...materialized.map((posting) => tx.get(accountRef(db, posting.accountId))),
      ]);

      if (ledgerSnapshot.exists) {
        return { transferId: idempotencyKey, alreadyApplied: true };
      }

      const nextBalances = materialized.map((posting, index) => {
        const current = BigInt(readBalance(accountSnapshots[index]));
        const next = current + posting.delta;
        if (next < 0n) {
          throw Object.assign(
            new Error("Insufficient token balance"),
            { statusCode: 402 },
          );
        }
        return { posting, next };
      });

      const timestamp = FieldValue.serverTimestamp();

      // `create` (not `set`) so a concurrent duplicate fails at the database.
      tx.create(ledgerRef, {
        assetId,
        reason,
        postings: postings.map((posting) => ({
          accountId: posting.accountId,
          delta: posting.delta.toString(),
        })),
        // Denormalized so a per-account history query is possible later without
        // reading every transfer.
        accountIds,
        competitionId: params.competitionId ?? null,
        metadata: params.metadata ?? null,
        // Null while the ledger is authoritative; the settlement transaction
        // hash once escrow moves on-chain.
        escrowRef: null,
        syncStatus: "local",
        createdAt: timestamp,
      });

      for (const { posting, next } of nextBalances) {
        const ownerId = ownerIdOf(posting.accountId);
        tx.set(
          accountRef(db, posting.accountId),
          {
            accountId: posting.accountId,
            kind: accountKind(posting.accountId),
            assetId,
            balance: toMinorUnits(next),
            ...(ownerId ? { ownerId } : {}),
            updatedAt: timestamp,
          },
          { merge: true },
        );
      }

      return { transferId: idempotencyKey, alreadyApplied: false };
    });
  } catch (error) {
    // Two callers raced on the same key; the loser's create() lost. That is the
    // idempotency guarantee working, not a failure.
    if ((error as { code?: number | string })?.code === 6) {
      return { transferId: idempotencyKey, alreadyApplied: true };
    }
    throw error;
  }
}

/**
 * Materialize a user's free starting balance, exactly once, ever.
 *
 * Keyed off the existence of the grant transfer rather than of the account
 * document: a user who receives a payout before ever checking their balance
 * would already have an account document, and must still get their grant. The
 * key also means the grant is never re-issued to a balance legitimately spent
 * down to zero.
 *
 * This mirrors how creditProxy materializes INITIAL_CREDITS lazily from every
 * entry point that reads or moves a balance, rather than at signup — which
 * matters here because normal signup writes users/{uid} from the client and
 * there is no server-side signup hook to attach to.
 */
export async function ensureInitialGrant(
  db: Firestore,
  uid: string,
): Promise<void> {
  const idempotencyKey = `grant:initial:${uid}`;
  const existing = await transferRef(db, idempotencyKey).get();
  if (existing.exists) return;

  const amount = getInitialGrantAmount();
  if (BigInt(amount) === 0n) return;

  try {
    await transfer(db, {
      idempotencyKey,
      reason: "grant:initial",
      postings: [
        { accountId: MINT_ACCOUNT, delta: -BigInt(amount) },
        { accountId: userAccount(uid), delta: BigInt(amount) },
      ],
    });
  } catch (error) {
    // Never block a read on a failed grant — surfacing a zero balance is far
    // better than failing the request that was trying to show it.
    logger.error("ensureInitialGrant failed", { uid, error });
  }
}

/**
 * Read a materialized balance, materializing the initial grant on first touch.
 * Every entry point that reads or moves a balance goes through here.
 */
export async function getBalance(
  db: Firestore,
  accountId: AccountId,
): Promise<MinorUnits> {
  const ownerId = ownerIdOf(accountId);
  if (ownerId) {
    await ensureInitialGrant(db, ownerId);
  }
  const snapshot = await accountRef(db, accountId).get();
  return readBalance(snapshot);
}

/** Balance read inside a caller's transaction, for read-then-write flows. */
export async function readBalanceInTransaction(
  db: Firestore,
  tx: Transaction,
  accountId: AccountId,
): Promise<MinorUnits> {
  return readBalance(await tx.get(accountRef(db, accountId)));
}
