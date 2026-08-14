/**
 * Platform token (TALE) types.
 *
 * TALE is an internal, non-redeemable token used for competition prize pools.
 * It is deliberately shaped like an ERC20 — 18 decimals, integer minor units,
 * an asset identifier — so that replacing the off-chain ledger with a real
 * token contract does not change how amounts are represented or displayed.
 *
 * KEEP IN SYNC with functions/src/money.ts.
 */

export const TALE_ASSET_ID = "TALE";
export const TALE_SYMBOL = "TALE";
export const TALE_DECIMALS = 18;

/**
 * A non-negative integer in base 10 — no sign, exponent, decimal point, or
 * leading zeros. "0" is valid. Branded so a raw string can't stand in for a
 * validated amount; build one with `toMinorUnits`/`parseTokenInput` from
 * `@/lib/money`.
 */
export type MinorUnits = string & { readonly __brand: "MinorUnits" };

export interface ITokenAmount {
  /** "TALE" today; "erc20:<chainId>:<address>" once the token is on-chain. */
  assetId: string;
  symbol: string;
  decimals: number;
  amount: MinorUnits;
}

/** Response shape of the getTokenBalance / claimTokenFaucet endpoints. */
export interface ITokenBalance {
  accountId: string;
  assetId: string;
  symbol: string;
  decimals: number;
  balance: MinorUnits;
}

/** Materialized balance doc at tokenAccounts/{accountId}. Server-written only. */
export interface ITokenAccountDoc {
  accountId: string;
  ownerId?: string;
  /** `platform` is the treasury that receives the platform's cut of entry fees. */
  kind: "user" | "escrow" | "platform";
  assetId: string;
  balance: string;
}
