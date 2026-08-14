/**
 * Escrow provider selection.
 *
 * Competition code imports `getEscrowProvider()` and nothing else from this
 * directory — never a concrete implementation. Swapping the off-chain ledger
 * for a contract is then a new class plus `ESCROW_PROVIDER=chain`, with no
 * change at any call site.
 *
 * Env-var selection matches the house idiom (FUNCTIONS_EMULATOR in
 * indexShared.ts, MAX_AI_USAGE / MAX_INDEX_USAGE in usageBudget.ts).
 */
import * as admin from "firebase-admin";
import { EscrowProvider } from "./EscrowProvider";
import { LedgerEscrow } from "./LedgerEscrow";

let cached: EscrowProvider | null = null;

export function getEscrowProvider(): EscrowProvider {
  if (cached) return cached;

  const configured = (process.env.ESCROW_PROVIDER || "ledger").toLowerCase();

  if (configured !== "ledger") {
    // Fail loudly rather than silently falling back: quietly using the
    // off-chain ledger when a deployment asked for the chain would mean paying
    // out play money for real prizes.
    throw new Error(
      `Unsupported ESCROW_PROVIDER "${configured}". Only "ledger" is implemented.`,
    );
  }

  cached = new LedgerEscrow(admin.firestore());
  return cached;
}

/** Test seam — lets a script inject a provider or reset the cache. */
export function __setEscrowProviderForTests(provider: EscrowProvider | null): void {
  cached = provider;
}

export type {
  EscrowProvider,
  EscrowOpResult,
  FundPurpose,
  PayoutInstruction,
  RefundInstruction,
} from "./EscrowProvider";
