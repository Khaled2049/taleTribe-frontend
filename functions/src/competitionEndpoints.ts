import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { corsOptions } from "./corsConfig";
import { requireAdmin, requireAuth } from "./authService";
import { getEscrowProvider } from "./escrow";
import {
  assertMinorUnits,
  getCompetitionFeeBps,
  makeTokenAmount,
} from "./money";
import {
  buildUnwindRefunds,
  readHeldContributions,
} from "./competitionContributions";
import {
  CompetitionPhase,
  EscrowState,
  canTransition,
  isEditablePhase,
  nextTransitionAt,
} from "./competitionPhase";
import {
  assertDateOrdering,
  validateCompetitionDraft,
  validateCompetitionInput,
  validateCompetitionUpdate,
} from "./competitionValidation";

const db = admin.firestore();

interface TokenAmountDoc {
  amount: string;
  assetId: string;
  symbol: string;
  decimals: number;
}

interface CompetitionDoc {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  startDate?: admin.firestore.Timestamp;
  deadline?: admin.firestore.Timestamp;
  votingDeadline?: admin.firestore.Timestamp;
  maxParticipants?: number | null;
  participantsCount?: number;
  phase?: CompetitionPhase;
  published?: boolean;
  escrowState?: EscrowState;
  creatorId?: string;
  prizePool?: TokenAmountDoc;
  entryFee?: TokenAmountDoc;
}

const toStatus = (error: unknown, fallback: number): number =>
  Number((error as { statusCode?: number })?.statusCode) || fallback;

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const joinCompetition = onRequest(
  corsOptions,
  requireAuth(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const competitionId = request.body?.competitionId;
      if (!competitionId || typeof competitionId !== "string") {
        response.status(400).json({ error: "competitionId is required" });
        return;
      }

      const competitionRef = db.collection("competitions").doc(competitionId);
      const participantRef = competitionRef.collection("participants").doc(userId);
      const userJoinRef = db
        .collection("users")
        .doc(userId)
        .collection("competitionJoins")
        .doc(competitionId);

      const joinedAt = await db.runTransaction(async (transaction) => {
        const [competitionSnapshot, participantSnapshot] = await Promise.all([
          transaction.get(competitionRef),
          transaction.get(participantRef),
        ]);

        if (!competitionSnapshot.exists) {
          const error = new Error("Competition not found");
          (error as any).statusCode = 404;
          throw error;
        }

        if (participantSnapshot.exists) {
          const error = new Error("You have already joined this competition");
          (error as any).statusCode = 409;
          throw error;
        }

        const data = competitionSnapshot.data() as CompetitionDoc;
        const startDate = data.startDate?.toDate?.();
        const deadline = data.deadline?.toDate?.();

        if (!startDate || !deadline) {
          const error = new Error("Competition has invalid dates");
          (error as any).statusCode = 422;
          throw error;
        }

        const now = Date.now();
        if (now > deadline.getTime()) {
          const error = new Error("Competition is closed");
          (error as any).statusCode = 422;
          throw error;
        }

        const participantsCount =
          typeof data.participantsCount === "number" ? data.participantsCount : 0;
        const maxParticipants =
          typeof data.maxParticipants === "number" ? data.maxParticipants : null;

        if (maxParticipants !== null && participantsCount >= maxParticipants) {
          const error = new Error("Competition is full");
          (error as any).statusCode = 409;
          throw error;
        }

        const timestamp = FieldValue.serverTimestamp();

        transaction.set(participantRef, {
          userId,
          joinedAt: timestamp,
        });

        transaction.set(
          userJoinRef,
          {
            competitionId,
            joinedAt: timestamp,
          },
          { merge: true }
        );

        transaction.update(competitionRef, {
          participantsCount: FieldValue.increment(1),
          updatedAt: timestamp,
        });

        return new Date().toISOString();
      });

      response.status(200).json({ success: true, joinedAt });
    } catch (error) {
      logger.error("Error joining competition", error);
      const statusCode = Number((error as any)?.statusCode) || 500;
      response.status(statusCode).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to join competition",
      });
    }
  })
);

/**
 * Resolve whether the caller may administer a competition.
 *
 * The creator always may. Anyone else must hold the `admin` claim, which costs
 * a second token verification — paid only on the non-creator path.
 */
async function assertCanManage(
  competition: CompetitionDoc,
  userId: string,
  authHeader: string | undefined,
): Promise<void> {
  if (competition.creatorId === userId) return;

  const { ensureAdmin } = await import("./authService");
  try {
    await ensureAdmin(authHeader);
  } catch {
    throw Object.assign(
      new Error("You do not have permission to manage this competition"),
      { statusCode: 403 },
    );
  }
}

/** Optional dates, so a half-finished draft can be stored as-is. */
const optionalTimestamp = (date: Date | undefined) =>
  date ? Timestamp.fromDate(date) : null;

/**
 * Create or update an unpublished draft. No money moves here.
 *
 * An upsert rather than separate create/update endpoints, so the editor can
 * autosave later without an API change: omit `competitionId` for a new draft,
 * supply it to overwrite an existing one.
 */
export const saveCompetitionDraft = onRequest(
  corsOptions,
  requireAdmin(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const draft = validateCompetitionDraft(request.body ?? {});
      const existingId = request.body?.competitionId;

      const creatorName =
        typeof request.body?.creatorName === "string" &&
        request.body.creatorName.trim()
          ? request.body.creatorName.trim().slice(0, 120)
          : "Admin";

      const timestamp = FieldValue.serverTimestamp();
      const fields = {
        title: draft.title,
        description: draft.description ?? "",
        category: draft.category ?? "",
        tags: draft.tags ?? [],
        maxParticipants: draft.maxParticipants ?? null,
        startDate: optionalTimestamp(draft.startDate),
        deadline: optionalTimestamp(draft.deadline),
        votingDeadline: optionalTimestamp(draft.votingDeadline),
        prizePool: draft.prizeAmount ? makeTokenAmount(draft.prizeAmount) : null,
        entryFee: draft.entryFee ? makeTokenAmount(draft.entryFee) : null,
        updatedAt: timestamp,
      };

      if (existingId) {
        if (typeof existingId !== "string") {
          response.status(400).json({ error: "competitionId must be a string" });
          return;
        }

        const ref = db.collection("competitions").doc(existingId);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
          response.status(404).json({ error: "Competition not found" });
          return;
        }

        const existing = snapshot.data() as CompetitionDoc;
        await assertCanManage(existing, userId, request.headers.authorization);

        // Publishing is one-way. Once escrow holds money the terms are governed
        // by updateCompetition, which refuses to touch the prize.
        if ((existing.phase ?? "open") !== "draft") {
          response.status(409).json({
            error: "This competition is already published — edit it instead",
          });
          return;
        }

        await ref.update(fields);
        response.status(200).json({ competitionId: existingId, phase: "draft" });
        return;
      }

      const ref = db.collection("competitions").doc();
      await ref.set({
        ...fields,
        phase: "draft" as CompetitionPhase,
        // The field the explore query and the rules both match on. A draft is
        // invisible to everyone but its creator until publish flips this.
        published: false,
        escrowState: "unfunded" as EscrowState,
        feeBps: getCompetitionFeeBps(),
        entryFeesHeld: "0",
        escrowAccountId: `escrow:competition:${ref.id}`,
        participantsCount: 0,
        submissionCount: 0,
        ballotCount: 0,
        creatorId: userId,
        creatorName,
        organizer: creatorName,
        phaseUpdatedAt: FieldValue.serverTimestamp(),
        nextTransitionAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      response.status(200).json({ competitionId: ref.id, phase: "draft" });
    } catch (error) {
      logger.error("Error saving competition draft", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to save draft") });
    }
  })
);

/**
 * Publish a draft: validate it fully, fund escrow, then open or schedule it.
 *
 * The three steps are deliberately not atomic, the same ordering the old
 * `createCompetition` used and for the same reason — escrow runs its own
 * transaction and, once on-chain, will be asynchronous.
 *
 * The failure mode is better than it used to be. If funding fails the
 * competition simply stays a draft: nothing is deleted, the host keeps their
 * work, and they can fix their balance and try again. Publishing is idempotent
 * on the escrow side because the funding key is derived from the competition id.
 */
export const publishCompetition = onRequest(
  corsOptions,
  requireAdmin(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const competitionId = request.body?.competitionId;
      if (!competitionId || typeof competitionId !== "string") {
        response.status(400).json({ error: "competitionId is required" });
        return;
      }

      const ref = db.collection("competitions").doc(competitionId);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        response.status(404).json({ error: "Competition not found" });
        return;
      }

      const existing = snapshot.data() as CompetitionDoc;
      await assertCanManage(existing, userId, request.headers.authorization);

      if ((existing.phase ?? "open") !== "draft") {
        response
          .status(409)
          .json({ error: "This competition has already been published" });
        return;
      }

      // Validate the STORED document, not the request. Publishing takes only an
      // id, so a client cannot smuggle different terms past the draft it showed
      // the host on screen.
      const input = validateCompetitionInput({
        title: existing.title,
        description: existing.description,
        category: existing.category,
        tags: existing.tags,
        maxParticipants: existing.maxParticipants,
        startDate: existing.startDate?.toDate?.()?.toISOString(),
        deadline: existing.deadline?.toDate?.()?.toISOString(),
        votingDeadline: existing.votingDeadline?.toDate?.()?.toISOString(),
        prizeAmount: existing.prizePool?.amount,
        entryFee: existing.entryFee?.amount,
      });

      const timestamp = FieldValue.serverTimestamp();
      await ref.update({
        escrowState: "funding" as EscrowState,
        updatedAt: timestamp,
      });

      const funded = await getEscrowProvider().fund({
        competitionId,
        funderUserId: userId,
        amount: input.prizeAmount,
        purpose: "seed",
        idempotencyKey: `escrow:fund:competition:${competitionId}`,
      });

      if (funded.state !== "confirmed") {
        // Still a draft, still private, still editable. Put the escrow state
        // back so a retry is not mistaken for a reconciliation target.
        await ref.update({
          escrowState: "unfunded" as EscrowState,
          updatedAt: FieldValue.serverTimestamp(),
        });
        response.status(funded.state === "failed" ? 402 : 409).json({
          error:
            funded.state === "failed"
              ? funded.reason
              : "Funding is still being confirmed",
        });
        return;
      }

      // A start date already in the past opens immediately rather than parking
      // in `scheduled`, which nothing would ever move it out of.
      const phase: CompetitionPhase =
        Date.now() >= input.startDate.getTime() ? "open" : "scheduled";

      await ref.update({
        phase,
        published: true,
        escrowState: "funded" as EscrowState,
        // Re-stamped from the validated input, so a draft saved with partial
        // dates cannot leave stale nulls behind.
        startDate: Timestamp.fromDate(input.startDate),
        deadline: Timestamp.fromDate(input.deadline),
        votingDeadline: Timestamp.fromDate(input.votingDeadline),
        prizePool: makeTokenAmount(input.prizeAmount),
        entryFee: makeTokenAmount(input.entryFee),
        feeBps: input.feeBps,
        phaseUpdatedAt: FieldValue.serverTimestamp(),
        nextTransitionAt: Timestamp.fromDate(
          nextTransitionAt(
            phase,
            input.startDate,
            input.deadline,
            input.votingDeadline,
          ) ?? input.deadline,
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Competition published", { competitionId, phase, userId });

      response.status(200).json({
        competitionId,
        phase,
        escrowState: "funded",
        prizePool: makeTokenAmount(input.prizeAmount),
      });
    } catch (error) {
      logger.error("Error publishing competition", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to publish competition") });
    }
  })
);

/**
 * Delete an unpublished draft outright.
 *
 * A real delete is safe here only because a draft holds no escrow and has never
 * been visible to anyone. Everything published is cancel-only — see
 * `cancelCompetition`, which refunds rather than removes.
 */
export const discardCompetitionDraft = onRequest(
  corsOptions,
  requireAdmin(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const competitionId = request.body?.competitionId;
      if (!competitionId || typeof competitionId !== "string") {
        response.status(400).json({ error: "competitionId is required" });
        return;
      }

      const ref = db.collection("competitions").doc(competitionId);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        response.status(404).json({ error: "Competition not found" });
        return;
      }

      const existing = snapshot.data() as CompetitionDoc;
      await assertCanManage(existing, userId, request.headers.authorization);

      if ((existing.phase ?? "open") !== "draft") {
        response.status(409).json({
          error: "A published competition can only be cancelled, not discarded",
        });
        return;
      }

      await ref.delete();
      logger.info("Competition draft discarded", { competitionId, userId });

      response.status(200).json({ competitionId, discarded: true });
    } catch (error) {
      logger.error("Error discarding competition draft", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to discard draft") });
    }
  })
);

/**
 * Edit a competition's details. The prize is immutable once funded — changing
 * it is a cancel-and-recreate, which keeps escrow accounting honest.
 */
export const updateCompetition = onRequest(
  corsOptions,
  requireAuth(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const competitionId = request.body?.competitionId;
      if (!competitionId || typeof competitionId !== "string") {
        response.status(400).json({ error: "competitionId is required" });
        return;
      }

      const competitionRef = db.collection("competitions").doc(competitionId);
      const snapshot = await competitionRef.get();
      if (!snapshot.exists) {
        response.status(404).json({ error: "Competition not found" });
        return;
      }

      const competition = snapshot.data() as CompetitionDoc;
      await assertCanManage(competition, userId, request.headers.authorization);

      const phase: CompetitionPhase = competition.phase ?? "open";
      if (!isEditablePhase(phase)) {
        response.status(409).json({
          error: `A competition in the ${phase} phase can no longer be edited`,
        });
        return;
      }

      const update = validateCompetitionUpdate(request.body ?? {});

      const startDate = update.startDate ?? competition.startDate?.toDate();
      const deadline = update.deadline ?? competition.deadline?.toDate();
      const votingDeadline =
        update.votingDeadline ?? competition.votingDeadline?.toDate() ?? null;

      if (!startDate || !deadline) {
        response.status(422).json({ error: "Competition has invalid dates" });
        return;
      }
      assertDateOrdering(startDate, deadline, votingDeadline);

      const timestamp = FieldValue.serverTimestamp();
      const next = nextTransitionAt(phase, startDate, deadline, votingDeadline);

      await competitionRef.update({
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.description !== undefined
          ? { description: update.description }
          : {}),
        ...(update.category !== undefined ? { category: update.category } : {}),
        ...(update.tags !== undefined ? { tags: update.tags } : {}),
        ...(update.maxParticipants !== undefined
          ? { maxParticipants: update.maxParticipants }
          : {}),
        ...(update.startDate ? { startDate: Timestamp.fromDate(startDate) } : {}),
        ...(update.deadline ? { deadline: Timestamp.fromDate(deadline) } : {}),
        ...(update.votingDeadline && votingDeadline
          ? { votingDeadline: Timestamp.fromDate(votingDeadline) }
          : {}),
        nextTransitionAt: next ? Timestamp.fromDate(next) : null,
        updatedAt: timestamp,
      });

      response.status(200).json({
        competitionId,
        phase,
        nextTransitionAt: next ? next.toISOString() : null,
      });
    } catch (error) {
      logger.error("Error updating competition", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to update competition") });
    }
  })
);

/**
 * Cancel a competition and refund its escrow to the creator.
 *
 * This replaces deletion: a competition holding a prize pool cannot simply be
 * removed, because the tokens have to go somewhere. Cancelling is idempotent —
 * calling it twice returns the same result rather than erroring, since the
 * refund itself is keyed.
 */
export const cancelCompetition = onRequest(
  corsOptions,
  requireAuth(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const competitionId = request.body?.competitionId;
      if (!competitionId || typeof competitionId !== "string") {
        response.status(400).json({ error: "competitionId is required" });
        return;
      }

      const competitionRef = db.collection("competitions").doc(competitionId);
      const snapshot = await competitionRef.get();
      if (!snapshot.exists) {
        response.status(404).json({ error: "Competition not found" });
        return;
      }

      const competition = snapshot.data() as CompetitionDoc;
      await assertCanManage(competition, userId, request.headers.authorization);

      const phase: CompetitionPhase = competition.phase ?? "open";
      const escrow = getEscrowProvider();

      if (phase === "cancelled") {
        response.status(200).json({
          competitionId,
          phase,
          refundedAmount: await escrow.escrowedAmount(competitionId),
        });
        return;
      }

      if (!canTransition(phase, "cancelled")) {
        response.status(409).json({
          error: `A competition in the ${phase} phase can no longer be cancelled`,
        });
        return;
      }

      const funderId = competition.creatorId ?? userId;
      const held = await escrow.escrowedAmount(competitionId);

      // Every funder gets their own money back — sweeping the balance to the
      // host would hand them the entrants' fees.
      const contributions = await readHeldContributions(db, competitionId);
      const refunded = await escrow.refund({
        competitionId,
        refunds: buildUnwindRefunds({
          seedUserId: funderId,
          seedAmount: assertMinorUnits(
            competition.prizePool?.amount ?? "0",
            "prizePool.amount",
          ),
          held: contributions,
        }),
        mode: "final",
        idempotencyKey: `escrow:refund:competition:${competitionId}`,
      });

      if (refunded.state === "failed") {
        // Leave the phase untouched — a competition whose escrow could not be
        // returned must not look cancelled.
        response.status(500).json({ error: refunded.reason });
        return;
      }

      const timestamp = FieldValue.serverTimestamp();
      const batch = db.batch();

      batch.update(competitionRef, {
        phase: "cancelled" as CompetitionPhase,
        escrowState: "refunded" as EscrowState,
        entryFeesHeld: "0",
        cancelledReason:
          typeof request.body?.reason === "string"
            ? request.body.reason.slice(0, 500)
            : null,
        phaseUpdatedAt: timestamp,
        nextTransitionAt: null,
        updatedAt: timestamp,
      });

      for (const contribution of contributions) {
        batch.update(
          competitionRef.collection("contributions").doc(contribution.userId),
          { state: "refunded", updatedAt: timestamp },
        );
      }

      await batch.commit();

      response.status(200).json({
        competitionId,
        phase: "cancelled",
        refundedAmount: held,
        refundedEntrants: contributions.length,
      });
    } catch (error) {
      logger.error("Error cancelling competition", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to cancel competition") });
    }
  })
);
