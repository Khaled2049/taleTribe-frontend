/**
 * TALE balance endpoints.
 *
 * TALE is an internal, non-redeemable token used for competition prize pools.
 * Balances live in the double-entry ledger (ledger.ts); nothing here writes a
 * balance directly.
 *
 * Follows the conventions in creditEndpoints.ts: requireAuth/requireAdmin, an
 * explicit 405 method guard, `{error: string}` on failure, and flat camelCase
 * success payloads.
 */
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { corsOptions } from "./corsConfig";
import { requireAdmin, requireAuth } from "./authService";
import { consumeDailyBudget } from "./usageBudget";
import {
  MINT_ACCOUNT,
  getBalance,
  getFaucetGrantAmount,
  transfer,
  userAccount,
} from "./ledger";
import {
  MinorUnits,
  TALE_ASSET_ID,
  TALE_DECIMALS,
  TALE_SYMBOL,
  assertMinorUnits,
  isPositive,
} from "./money";

const db = admin.firestore();

/**
 * Ceiling on a single admin grant. Not a security boundary — an admin can call
 * this repeatedly — but it turns a fat-fingered extra zero into a 400 rather
 * than a balance nobody can explain.
 */
const MAX_ADMIN_GRANT = "1000000000000000000000000" as MinorUnits; // 1,000,000 TALE

const balancePayload = (accountId: string, balance: MinorUnits) => ({
  accountId,
  assetId: TALE_ASSET_ID,
  symbol: TALE_SYMBOL,
  decimals: TALE_DECIMALS,
  balance,
});

/**
 * Current TALE balance for the caller. Materializes the free starting grant on
 * first touch, so a user who checks their balance before ever spending still
 * sees and keeps it.
 */
export const getTokenBalance = onRequest(
  corsOptions,
  requireAuth(async (request, response, userId) => {
    try {
      const accountId = userAccount(userId);
      const balance = await getBalance(db, accountId);
      response.status(200).json(balancePayload(accountId, balance));
    } catch (error) {
      logger.error("Error reading token balance", { userId, error });
      response.status(500).json({ error: "Failed to read token balance" });
    }
  })
);

/**
 * Claim the once-per-day faucet.
 *
 * The daily limit reuses consumeDailyBudget, which is already atomic and fails
 * closed. The budget is consumed BEFORE the transfer: if the transfer then
 * fails the user loses a claim, which is the safe direction to fail for a
 * faucet — the opposite ordering would let a retry loop mint repeatedly.
 */
export const claimTokenFaucet = onRequest(
  corsOptions,
  requireAuth(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const accountId = userAccount(userId);
      const today = new Date().toISOString().split("T")[0];
      const granted = getFaucetGrantAmount();

      const allowed = await consumeDailyBudget(userId, {
        usageField: "faucetUsage",
        dateField: "lastFaucetDate",
        limit: 1,
      });

      if (!allowed) {
        const balance = await getBalance(db, accountId);
        response.status(429).json({
          error: "You have already claimed tokens today. Try again tomorrow.",
          ...balancePayload(accountId, balance),
        });
        return;
      }

      await transfer(db, {
        // Date in the key so tomorrow's claim is a different transfer, while a
        // retry of today's is a no-op.
        idempotencyKey: `grant:faucet:${userId}:${today}`,
        reason: "grant:faucet",
        postings: [
          { accountId: MINT_ACCOUNT, delta: -BigInt(granted) },
          { accountId, delta: BigInt(granted) },
        ],
      });

      const balance = await getBalance(db, accountId);
      response.status(200).json({ ...balancePayload(accountId, balance), granted });
    } catch (error) {
      logger.error("Error claiming token faucet", { userId, error });
      response.status(500).json({ error: "Failed to claim tokens" });
    }
  })
);

/**
 * Grant TALE to a user. Admin only — this mints supply.
 *
 * `nonce` is part of the idempotency key so a deliberate second grant to the
 * same user is possible, while a retried request is not double-applied.
 */
export const adminGrantTokens = onRequest(
  corsOptions,
  requireAdmin(async (request, response, adminUserId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { userId, amount, nonce } = request.body ?? {};

      if (!userId || typeof userId !== "string") {
        response.status(400).json({ error: "userId is required" });
        return;
      }
      if (!nonce || typeof nonce !== "string" || nonce.length > 64) {
        response
          .status(400)
          .json({ error: "nonce is required (max 64 chars)" });
        return;
      }

      let minorUnits: MinorUnits;
      try {
        minorUnits = assertMinorUnits(amount, "amount");
      } catch {
        response.status(400).json({
          error: "amount must be a non-negative integer string in minor units",
        });
        return;
      }

      if (!isPositive(minorUnits)) {
        response.status(400).json({ error: "amount must be greater than zero" });
        return;
      }
      if (BigInt(minorUnits) > BigInt(MAX_ADMIN_GRANT)) {
        response
          .status(400)
          .json({ error: "amount exceeds the maximum single grant" });
        return;
      }

      try {
        await admin.auth().getUser(userId);
      } catch {
        response.status(404).json({ error: "User not found" });
        return;
      }

      const accountId = userAccount(userId);
      const result = await transfer(db, {
        idempotencyKey: `grant:admin:${userId}:${nonce}`,
        reason: "grant:admin",
        postings: [
          { accountId: MINT_ACCOUNT, delta: -BigInt(minorUnits) },
          { accountId, delta: BigInt(minorUnits) },
        ],
        metadata: { grantedBy: adminUserId },
      });

      const balance = await getBalance(db, accountId);
      response.status(200).json({
        userId,
        ...balancePayload(accountId, balance),
        transferId: result.transferId,
        alreadyApplied: result.alreadyApplied,
      });
    } catch (error) {
      logger.error("Error granting tokens", { adminUserId, error });
      response.status(500).json({ error: "Failed to grant tokens" });
    }
  })
);
