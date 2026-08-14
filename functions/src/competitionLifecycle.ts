/**
 * Driving competitions through their phases.
 *
 * Two mechanisms, with clearly different jobs:
 *
 * - **`ensurePhase` (lazy) is the correctness backbone.** Every competition
 *   endpoint calls it first, so a competition is always in the right phase by
 *   the time anything acts on it, regardless of whether a scheduled task ever
 *   ran. This matters because Cloud Tasks caps `scheduleDelaySeconds` at 30
 *   days — a competition with a longer window simply cannot be enqueued at
 *   creation, so tasks alone would be incorrect, not merely unreliable.
 *
 * - **`enqueueAdvance` (tasks) is a liveness driver.** It exists so a
 *   competition flips to `voting` promptly even if nobody touches it. Tasks are
 *   strictly **advisory**: the handler re-reads the document and does nothing
 *   if the world has moved on. Nothing is ever cancelled or deleted on edit —
 *   a new task id is enqueued and the stale one no-ops, exactly the reasoning
 *   already documented for the indexing debounce in indexShared.ts.
 *
 * Settlement (`voting -> settled`) is deliberately absent from both: it needs a
 * tally, so only the settlement transaction may make that move.
 */
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import {
  CompetitionPhase,
  canTransition,
  dueTimePhase,
  nextTransitionAt,
} from "./competitionPhase";

export const ADVANCE_QUEUE = "competitionAdvanceTask";

/**
 * Cloud Tasks rejects a schedule time more than 30 days out. Stay clear of the
 * boundary; anything beyond it is covered by lazy advance plus the re-enqueue
 * that happens on the next transition.
 */
const MAX_TASK_DELAY_SECONDS = 25 * 24 * 60 * 60;

export interface AdvanceTaskPayload {
  competitionId: string;
  targetPhase: CompetitionPhase;
  /** Deadline the task was scheduled against; used to detect a moved date. */
  expectedAtMs: number;
}

/**
 * Ask for a competition to be advanced at a given time.
 *
 * The target timestamp is part of the dedup id, so editing a deadline produces
 * a different task rather than needing the old one deleted.
 */
export async function enqueueAdvance(
  competitionId: string,
  targetPhase: CompetitionPhase,
  atMs: number,
): Promise<void> {
  const delaySeconds = Math.max(0, Math.floor((atMs - Date.now()) / 1000));

  if (delaySeconds > MAX_TASK_DELAY_SECONDS) {
    // Too far out to schedule. Lazy advance covers correctness, and the next
    // transition will re-enqueue within range.
    return;
  }

  const payload: AdvanceTaskPayload = {
    competitionId,
    targetPhase,
    expectedAtMs: atMs,
  };

  try {
    await getFunctions()
      .taskQueue(ADVANCE_QUEUE)
      .enqueue(payload, {
        id: `advance-${competitionId}-${targetPhase}-${atMs}`,
        scheduleDelaySeconds: delaySeconds,
      });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    // Already scheduled for this exact target — that is the dedup working.
    if (code === "functions/task-already-exists") return;
    logger.warn("enqueueAdvance failed", { competitionId, targetPhase, error });
  }
}

interface EnsurePhaseResult {
  phase: CompetitionPhase;
  changed: boolean;
}

/**
 * Bring a competition's stored phase up to date with the clock.
 *
 * Idempotent and transactional, so concurrent callers cannot double-advance.
 * Advances one legal step at a time and re-checks, since a competition
 * untouched for a while may be due to move twice (draft -> open -> voting).
 *
 * A `scheduled` competition whose escrow never confirmed is deliberately held
 * back: opening it for entries when its prize pool does not exist would promise
 * a prize nobody can pay. A `draft` is never touched here at all.
 */
export async function ensurePhase(
  db: Firestore,
  competitionId: string,
  now: number = Date.now(),
): Promise<EnsurePhaseResult> {
  const ref = db.collection("competitions").doc(competitionId);

  const result = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw Object.assign(new Error("Competition not found"), {
        statusCode: 404,
      });
    }

    const data = snapshot.data() ?? {};
    let phase: CompetitionPhase = (data.phase as CompetitionPhase) ?? "open";

    const startDate = (data.startDate as Timestamp | undefined)?.toDate();
    const deadline = (data.deadline as Timestamp | undefined)?.toDate();
    const votingDeadline = (
      data.votingDeadline as Timestamp | undefined
    )?.toDate();

    if (!startDate || !deadline) {
      return { phase, changed: false };
    }

    let changed = false;
    // At most two steps exist below settlement; the bound also guarantees
    // termination if a future phase is ever added carelessly.
    for (let step = 0; step < 2; step++) {
      const due = dueTimePhase(phase, startDate, deadline, now);
      if (!due || !canTransition(phase, due)) break;

      if (due === "open" && data.escrowState !== "funded") {
        // Prize pool never confirmed — hold in draft rather than opening.
        break;
      }

      phase = due;
      changed = true;
    }

    if (!changed) return { phase, changed: false };

    const next = nextTransitionAt(phase, startDate, deadline, votingDeadline);
    tx.update(ref, {
      phase,
      phaseUpdatedAt: FieldValue.serverTimestamp(),
      nextTransitionAt: next ? Timestamp.fromDate(next) : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { phase, changed: true, nextAt: next?.getTime() ?? null };
  });

  // Chain the next hop outside the transaction — enqueueing inside it would
  // schedule work for a transaction that might still be retried.
  if (result.changed) {
    const nextAt = (result as { nextAt?: number | null }).nextAt;
    const following = followingPhase(result.phase);
    if (nextAt && following) {
      await enqueueAdvance(competitionId, following, nextAt);
    }
  }

  return { phase: result.phase, changed: result.changed };
}

/**
 * The phase that naturally follows, for scheduling purposes only.
 *
 * `voting -> settled` IS scheduled, but the task does not perform the
 * transition itself — it calls settleCompetition, which claims `settling`,
 * pays, and only then writes `settled`. The clock decides *when* to try,
 * never *what* the outcome is.
 */
function followingPhase(phase: CompetitionPhase): CompetitionPhase | null {
  // `draft` returns null: an unpublished competition has no scheduled future, so
  // nothing is ever enqueued for one.
  if (phase === "scheduled") return "open";
  if (phase === "open") return "voting";
  if (phase === "voting") return "settled";
  return null;
}

/**
 * Load a competition, advancing its phase first. The single entry point every
 * entry/voting endpoint uses, so no handler can act on a stale phase.
 */
export async function loadCompetitionWithPhase(
  db: Firestore,
  competitionId: string,
): Promise<{
  ref: admin.firestore.DocumentReference;
  data: admin.firestore.DocumentData;
  phase: CompetitionPhase;
}> {
  const { phase } = await ensurePhase(db, competitionId);
  const ref = db.collection("competitions").doc(competitionId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw Object.assign(new Error("Competition not found"), { statusCode: 404 });
  }

  return { ref, data: snapshot.data() ?? {}, phase };
}
