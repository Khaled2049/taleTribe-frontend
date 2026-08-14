/**
 * Who has paid into a competition's escrow, and how much.
 *
 * An entrant's fee sits in the same escrow account as the host's seed, so
 * unwinding that account has to return each contribution to whoever made it.
 * The single place that list is reconstructed, so cancel and the no-winner
 * settlement path cannot disagree on who gets what.
 */
import { Firestore } from "firebase-admin/firestore";
import { MinorUnits, assertMinorUnits } from "./money";
import { RefundInstruction } from "./escrow";

export const CONTRIBUTIONS = "contributions";

/** Matches MAX_SUBMISSIONS_PER_COMPETITION — one contribution per entrant. */
const MAX_CONTRIBUTIONS_READ = 500;

/**
 * `pending` — written, escrow transfer not yet confirmed.
 * `held`    — the money is in escrow and owed back if the competition unwinds.
 * `refunded`— returned to the entrant (withdrawal, cancellation, or no winner).
 * `settled` — consumed by a completed settlement and split as revenue.
 */
export type ContributionState = "pending" | "held" | "refunded" | "settled";

export interface HeldContribution {
  userId: string;
  amount: MinorUnits;
}

/**
 * Every entry fee currently sitting in escrow.
 *
 * `pending` is excluded: that money is not in the account yet, so including it
 * would make a refund claim to return more than is held.
 */
export async function readHeldContributions(
  db: Firestore,
  competitionId: string,
): Promise<HeldContribution[]> {
  const snapshot = await db
    .collection("competitions")
    .doc(competitionId)
    .collection(CONTRIBUTIONS)
    .where("state", "==", "held")
    .limit(MAX_CONTRIBUTIONS_READ)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      userId: (data.userId as string) ?? doc.id,
      amount: assertMinorUnits(data.amount, "contribution amount"),
    };
  });
}

/** Total of a contribution list, for reconciling against `entryFeesHeld`. */
export function totalContributions(
  contributions: HeldContribution[],
): MinorUnits {
  const total = contributions.reduce(
    (sum, contribution) => sum + BigInt(contribution.amount),
    0n,
  );
  return total.toString() as MinorUnits;
}

/**
 * The full unwind: the host's seed plus every held entry fee, back to source.
 *
 * The host is an ordinary instruction rather than a special case, so a host who
 * also holds a contribution collapses into one refund downstream instead of
 * producing a duplicate-account error.
 */
export function buildUnwindRefunds(args: {
  seedUserId: string;
  seedAmount: MinorUnits;
  held: HeldContribution[];
}): RefundInstruction[] {
  const refunds: RefundInstruction[] = args.held.map((contribution) => ({
    userId: contribution.userId,
    amount: contribution.amount,
  }));

  if (BigInt(args.seedAmount) > 0n) {
    refunds.push({ userId: args.seedUserId, amount: args.seedAmount });
  }

  return refunds;
}
