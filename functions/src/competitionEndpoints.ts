import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { corsOptions } from "./corsConfig";
import { requireAdmin, requireAuth } from "./authService";
import { getEscrowProvider } from "./escrow";
import { makeTokenAmount } from "./money";
import {
  CompetitionPhase,
  EscrowState,
  canTransition,
  isEditablePhase,
  nextTransitionAt,
} from "./competitionPhase";
import {
  assertDateOrdering,
  validateCompetitionInput,
  validateCompetitionUpdate,
} from "./competitionValidation";

const db = admin.firestore();

interface CompetitionDoc {
  startDate?: admin.firestore.Timestamp;
  deadline?: admin.firestore.Timestamp;
  votingDeadline?: admin.firestore.Timestamp;
  maxParticipants?: number | null;
  participantsCount?: number;
  phase?: CompetitionPhase;
  escrowState?: EscrowState;
  creatorId?: string;
  prizePool?: { amount: string; assetId: string; symbol: string; decimals: number };
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

/**
 * Create a competition and fund its prize pool.
 *
 * Creation and funding are deliberately NOT one atomic unit. The document is
 * written first in `draft`/`funding`, then escrow is funded, then the phase is
 * advanced. That ordering is what lets this survive escrow moving on-chain,
 * where funding is an asynchronous transaction that can be pending or revert
 * long after the document exists.
 *
 * If funding fails outright, the draft is removed — no money moved and nothing
 * else references it yet. A crash between the two steps leaves a document in
 * `escrowState: "funding"`, which is exactly the state a reconciliation sweep
 * would look for.
 */
export const createCompetition = onRequest(
  corsOptions,
  requireAdmin(async (request, response, userId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const input = validateCompetitionInput(request.body ?? {});
      const escrow = getEscrowProvider();

      const creatorName =
        typeof request.body?.creatorName === "string" &&
        request.body.creatorName.trim()
          ? request.body.creatorName.trim().slice(0, 120)
          : "Admin";

      const competitionRef = db.collection("competitions").doc();
      const competitionId = competitionRef.id;
      const timestamp = FieldValue.serverTimestamp();

      await competitionRef.set({
        title: input.title,
        description: input.description,
        category: input.category,
        tags: input.tags,
        maxParticipants: input.maxParticipants,
        startDate: Timestamp.fromDate(input.startDate),
        deadline: Timestamp.fromDate(input.deadline),
        votingDeadline: Timestamp.fromDate(input.votingDeadline),
        phase: "draft" as CompetitionPhase,
        escrowState: "funding" as EscrowState,
        prizePool: makeTokenAmount(input.prizeAmount),
        escrowAccountId: `escrow:competition:${competitionId}`,
        participantsCount: 0,
        submissionCount: 0,
        ballotCount: 0,
        creatorId: userId,
        creatorName,
        organizer: creatorName,
        phaseUpdatedAt: timestamp,
        nextTransitionAt: Timestamp.fromDate(input.startDate),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const funded = await escrow.fund({
        competitionId,
        funderUserId: userId,
        amount: input.prizeAmount,
        idempotencyKey: `escrow:fund:competition:${competitionId}`,
      });

      if (funded.state === "failed") {
        await competitionRef.delete();
        response.status(402).json({ error: funded.reason });
        return;
      }

      // A future start stays in `draft` until its start date; the phase sweep
      // and lazy advance both move it to `open`.
      const now = Date.now();
      const phase: CompetitionPhase =
        now >= input.startDate.getTime() ? "open" : "draft";

      await competitionRef.update({
        phase,
        escrowState: "funded" as EscrowState,
        phaseUpdatedAt: timestamp,
        nextTransitionAt: Timestamp.fromDate(
          nextTransitionAt(
            phase,
            input.startDate,
            input.deadline,
            input.votingDeadline,
          ) ?? input.deadline,
        ),
        updatedAt: timestamp,
      });

      response.status(200).json({
        competitionId,
        phase,
        escrowState: "funded",
        prizePool: makeTokenAmount(input.prizeAmount),
      });
    } catch (error) {
      logger.error("Error creating competition", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to create competition") });
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

      const refunded = await escrow.refund({
        competitionId,
        funderUserId: funderId,
        idempotencyKey: `escrow:refund:competition:${competitionId}`,
      });

      if (refunded.state === "failed") {
        // Leave the phase untouched — a competition whose escrow could not be
        // returned must not look cancelled.
        response.status(500).json({ error: refunded.reason });
        return;
      }

      const timestamp = FieldValue.serverTimestamp();
      await competitionRef.update({
        phase: "cancelled" as CompetitionPhase,
        escrowState: "refunded" as EscrowState,
        cancelledReason:
          typeof request.body?.reason === "string"
            ? request.body.reason.slice(0, 500)
            : null,
        phaseUpdatedAt: timestamp,
        nextTransitionAt: null,
        updatedAt: timestamp,
      });

      response.status(200).json({
        competitionId,
        phase: "cancelled",
        refundedAmount: held,
      });
    } catch (error) {
      logger.error("Error cancelling competition", { userId, error });
      response
        .status(toStatus(error, 500))
        .json({ error: errorMessage(error, "Failed to cancel competition") });
    }
  })
);
