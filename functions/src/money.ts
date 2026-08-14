/**
 * Money primitives for the platform token (TALE).
 *
 * KEEP IN SYNC with src/lib/money.ts on the frontend. The two files are
 * deliberate duplicates rather than a shared package: the frontend builds with
 * Vite/ESM and functions builds with tsc/CommonJS, and there is no shared
 * workspace between them. The same duplicate-and-comment approach is used for
 * the credit tiers in creditEndpoints.ts.
 *
 * Why strings and not numbers: TALE has 18 decimals, so one whole token is
 * 10^18 minor units — far past Number.MAX_SAFE_INTEGER (~9.007e15). Any float
 * arithmetic on a balance is silently wrong. Every amount that crosses a
 * boundary (Firestore, HTTP, this module) is a base-10 integer string; every
 * calculation in between is BigInt. This is also exactly how a uint256 behaves
 * on-chain, so the representation survives the move to a real ERC20 unchanged.
 */

export const TALE_ASSET_ID = "TALE";
export const TALE_SYMBOL = "TALE";
export const TALE_DECIMALS = 18;

/**
 * Basis points: 10000 bps = 100%. Values mirror TippingPlatform.sol, so the
 * entry-fee split and the on-chain tip split share one ceiling.
 */
export const BPS_DENOMINATOR = 10000n;
export const MAX_FEE_BPS = 3000;
export const DEFAULT_FEE_BPS = 1000;

/** Platform's cut of entry fees, resolved once at competition creation. */
export function getCompetitionFeeBps(): number {
  const parsed = Number.parseInt(
    process.env.COMPETITION_FEE_BPS || String(DEFAULT_FEE_BPS),
    10,
  );
  if (Number.isNaN(parsed) || parsed < 0 || parsed > MAX_FEE_BPS) {
    return DEFAULT_FEE_BPS;
  }
  return parsed;
}

/**
 * A non-negative integer in base 10, with no sign, exponent, decimal point, or
 * leading zeros. "0" is valid. The brand stops an arbitrary string being passed
 * where a validated amount is required — construct via `toMinorUnits` or
 * `assertMinorUnits`, never by casting.
 */
export type MinorUnits = string & { readonly __brand: "MinorUnits" };

export interface ITokenAmount {
  /**
   * "TALE" today. Once the token is a real ERC20 this becomes something like
   * "erc20:11155111:0x…" — this string is the seam that lets a single ledger
   * carry more than one asset without changing any amount handling.
   */
  assetId: string;
  symbol: string;
  decimals: number;
  amount: MinorUnits;
}

/** Caps length at 78 digits — one more than uint256's max (~1.16e77). */
const MINOR_UNITS_RE = /^(0|[1-9][0-9]{0,77})$/;

export function isMinorUnits(value: unknown): value is MinorUnits {
  return typeof value === "string" && MINOR_UNITS_RE.test(value);
}

/** Throws a 400-shaped error unless `value` is a valid minor-unit string. */
export function assertMinorUnits(value: unknown, field = "amount"): MinorUnits {
  if (!isMinorUnits(value)) {
    throw Object.assign(
      new Error(`${field} must be a non-negative integer string in minor units`),
      { statusCode: 400 },
    );
  }
  return value;
}

/** BigInt -> MinorUnits. Throws on negatives; balances are never signed. */
export function toMinorUnits(value: bigint): MinorUnits {
  if (value < 0n) {
    throw Object.assign(new Error("Amount cannot be negative"), {
      statusCode: 400,
    });
  }
  return value.toString() as MinorUnits;
}

/** Whole tokens -> minor units, e.g. wholeToMinorUnits(100) for 100 TALE. */
export function wholeToMinorUnits(whole: number, decimals = TALE_DECIMALS): MinorUnits {
  if (!Number.isSafeInteger(whole) || whole < 0) {
    throw Object.assign(new Error("Whole token amount must be a non-negative integer"), {
      statusCode: 400,
    });
  }
  return toMinorUnits(BigInt(whole) * 10n ** BigInt(decimals));
}

export const ZERO = "0" as MinorUnits;

export const toBigInt = (value: MinorUnits): bigint => BigInt(value);

export const addMinor = (a: MinorUnits, b: MinorUnits): MinorUnits =>
  toMinorUnits(BigInt(a) + BigInt(b));

/** Throws rather than going negative — an underflow here is an overdraft. */
export function subMinor(a: MinorUnits, b: MinorUnits): MinorUnits {
  const result = BigInt(a) - BigInt(b);
  if (result < 0n) {
    throw Object.assign(new Error("Insufficient balance"), { statusCode: 402 });
  }
  return toMinorUnits(result);
}

/** -1 | 0 | 1, so callers never compare amount strings lexicographically. */
export function cmpMinor(a: MinorUnits, b: MinorUnits): -1 | 0 | 1 {
  const left = BigInt(a);
  const right = BigInt(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export const gteMinor = (a: MinorUnits, b: MinorUnits): boolean => cmpMinor(a, b) >= 0;
export const isZero = (a: MinorUnits): boolean => BigInt(a) === 0n;
export const isPositive = (a: MinorUnits): boolean => BigInt(a) > 0n;

/**
 * floor(value * numerator / denominator). Used for payout splits, where the
 * floored remainder is deliberately handled by the caller (settlement pushes it
 * onto rank 1) so an escrow account always drains to exactly zero.
 */
export function mulDivFloor(
  value: MinorUnits,
  numerator: bigint,
  denominator: bigint,
): MinorUnits {
  if (denominator === 0n) {
    throw new Error("mulDivFloor: denominator cannot be zero");
  }
  return toMinorUnits((BigInt(value) * numerator) / denominator);
}

/**
 * Display only — never feed the result back into arithmetic. Trims trailing
 * zeros in the fraction so 1 TALE renders as "1" rather than "1.000000000000000000".
 *
 * The frontend copy of this module delegates to viem's formatUnits, which is
 * already a dependency there; functions has no viem, so this is hand-rolled.
 */
export function formatMinorUnits(value: MinorUnits, decimals = TALE_DECIMALS): string {
  const raw = BigInt(value).toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, raw.length - decimals);
  const fraction = raw.slice(raw.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function makeTokenAmount(amount: MinorUnits): ITokenAmount {
  return {
    assetId: TALE_ASSET_ID,
    symbol: TALE_SYMBOL,
    decimals: TALE_DECIMALS,
    amount,
  };
}
