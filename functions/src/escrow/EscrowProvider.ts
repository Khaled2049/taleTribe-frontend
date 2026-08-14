/**
 * The boundary between competitions and money.
 *
 * This interface is the entire swap seam. Today `LedgerEscrow` implements it
 * over the off-chain double-entry ledger; later `ChainEscrow` implements the
 * same methods against an escrow contract and its ERC20. Competition code calls
 * only these methods, so that swap is a new file plus an env var — not a
 * rewrite.
 *
 * Three properties of a real chain are built into the shape now, while they are
 * still free to add:
 *
 * 1. **`"pending"` is a first-class result.** An on-chain transaction is not
 *    confirmed when the call returns. `LedgerEscrow` never returns it, but
 *    every caller must already handle it, and `escrowState` on the competition
 *    document already carries a matching `"funding"` value. Cost today: one
 *    member of a union.
 *
 * 2. **Payouts name a `userId`, never a wallet address.** Resolving a user to an
 *    address — and deciding what to do when they have none — is the provider's
 *    private problem. Putting an address in this interface would leak an
 *    unverified `users/{uid}.walletAddress` into settlement logic.
 *
 * 3. **Every mutating method takes an `idempotencyKey`.** Chain writes are
 *    retryable and at-least-once; a payout must never be applied twice.
 *
 * What is deliberately NOT here: gas, nonces, confirmations, chain ids, ABIs.
 * If any of those ever need to appear in a signature, the abstraction has
 * failed and the leak should be fixed inside the provider instead.
 */
import { MinorUnits } from "../money";

export type EscrowOpState = "confirmed" | "pending" | "failed";

export type EscrowOpResult =
  | { state: "confirmed"; opId: string }
  /** Accepted but not yet final. `pollAfterMs` hints when to re-check. */
  | { state: "pending"; opId: string; pollAfterMs: number }
  | { state: "failed"; opId: string; reason: string };

export interface PayoutInstruction {
  userId: string;
  amount: MinorUnits;
}

/**
 * Why money is entering escrow. One movement either way, so this is a
 * discriminator rather than two methods; on-chain it selects the event emitted.
 */
export type FundPurpose = "seed" | "entry";

export interface FundParams {
  competitionId: string;
  funderUserId: string;
  amount: MinorUnits;
  purpose: FundPurpose;
  idempotencyKey: string;
}

export interface ReleaseParams {
  competitionId: string;
  payouts: PayoutInstruction[];
  /**
   * The platform's cut of the entry fees. Separate from `payouts` because the
   * platform has no `userId`; where it lands is the provider's business, as
   * with a winner's address. On-chain, `owner()`.
   */
  platformFee?: MinorUnits;
  /**
   * SHA-256 of the canonical results payload. Recorded alongside the movement
   * so a payout is always traceable to the tally that justified it; the chain
   * implementation commits this as bytes32.
   */
  resultsDigest: string;
  idempotencyKey: string;
}

export interface RefundInstruction {
  userId: string;
  amount: MinorUnits;
}

/**
 * A refund enumerates every funder and their exact amount.
 *
 * Sweeping the balance to one funder was correct only while the host was the
 * sole one; with paid entry it pays the entrants' fees to the host. Enumerating
 * is also what a contract needs, since it cannot iterate an unbounded mapping.
 */
export interface RefundParams {
  competitionId: string;
  refunds: RefundInstruction[];
  /**
   * `"final"` must drain escrow to exactly zero; `"partial"` (one entrant
   * withdrawing) only has to fit inside the balance. Explicit rather than
   * inferred, so a lone withdrawal cannot accidentally satisfy the full-drain
   * check on a competition holding nothing else yet.
   */
  mode: "partial" | "final";
  idempotencyKey: string;
}

export interface EscrowProvider {
  readonly assetId: string;
  readonly symbol: string;
  readonly decimals: number;

  /** Move `amount` from the funder into the competition's escrow. */
  fund(params: FundParams): Promise<EscrowOpResult>;

  /**
   * Distribute escrow to winners, the host, and the platform. Payouts plus
   * `platformFee` must drain the balance exactly — a leftover is stranded
   * forever, since nothing else reads that account.
   */
  release(params: ReleaseParams): Promise<EscrowOpResult>;

  /** Return escrow to the funders named in `refunds`. */
  refund(params: RefundParams): Promise<EscrowOpResult>;

  escrowedAmount(competitionId: string): Promise<MinorUnits>;

  /** What a user could commit to a new competition right now. */
  spendableBalance(userId: string): Promise<MinorUnits>;

  /** Re-check an operation by its id — the polling half of `"pending"`. */
  getOperation(opId: string): Promise<EscrowOpResult>;
}
