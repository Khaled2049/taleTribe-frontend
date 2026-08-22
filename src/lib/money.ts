/**
 * Money helpers for the platform token (TALE).
 *
 * KEEP IN SYNC with functions/src/money.ts — same validator, same semantics.
 * The two copies exist because the frontend and functions have separate builds
 * with no shared workspace; the credit tiers in creditEndpoints.ts are
 * duplicated the same way.
 *
 * Amounts are always integer minor-unit strings, never numbers: one whole TALE
 * is 10^18 minor units, well past Number.MAX_SAFE_INTEGER, so float arithmetic
 * on a balance is silently wrong. Formatting and user-input parsing delegate to
 * viem (already a dependency, and already the idiom in useTokenBalance.ts), but
 * only validated minor-unit strings are ever stored or sent.
 */
import { formatUnits, parseUnits } from "viem";
import {
  TALE_ASSET_ID,
  TALE_DECIMALS,
  TALE_SYMBOL,
  type ITokenAmount,
  type MinorUnits,
} from "@/types/IToken";

/**
 * Basis points: 10000 bps = 100%.
 *
 * The client knows the fee rate so it can say "the platform takes 10%", and
 * deliberately has no way to compute the resulting split — `splitEntryFees`
 * divides the money server-side at settlement.
 */
export const BPS_DENOMINATOR = 10000;
export const DEFAULT_FEE_BPS = 1000;

/** "1000" -> "10%". Display only; trims a trailing ".0" so 10% isn't "10.0%". */
export function formatFeeBps(bps: number): string {
  const percent = (bps / BPS_DENOMINATOR) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

/** Caps length at 78 digits — one past uint256's maximum. */
const MINOR_UNITS_RE = /^(0|[1-9][0-9]{0,77})$/;

export function isMinorUnits(value: unknown): value is MinorUnits {
  return typeof value === "string" && MINOR_UNITS_RE.test(value);
}

export function toMinorUnits(value: bigint): MinorUnits {
  if (value < 0n) throw new Error("Amount cannot be negative");
  return value.toString() as MinorUnits;
}

export const ZERO = "0" as MinorUnits;

export const addMinor = (a: MinorUnits, b: MinorUnits): MinorUnits =>
  toMinorUnits(BigInt(a) + BigInt(b));

/** Throws rather than going negative — an underflow here is an overdraft. */
export function subMinor(a: MinorUnits, b: MinorUnits): MinorUnits {
  const result = BigInt(a) - BigInt(b);
  if (result < 0n) throw new Error("Insufficient balance");
  return toMinorUnits(result);
}

export function cmpMinor(a: MinorUnits, b: MinorUnits): -1 | 0 | 1 {
  const left = BigInt(a);
  const right = BigInt(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export const gteMinor = (a: MinorUnits, b: MinorUnits): boolean =>
  cmpMinor(a, b) >= 0;
export const isZero = (a: MinorUnits): boolean => BigInt(a) === 0n;
export const isPositive = (a: MinorUnits): boolean => BigInt(a) > 0n;

/**
 * Display only — never feed the result back into arithmetic.
 * `formatUnits` trims nothing, so 1 TALE would render as
 * "1.000000000000000000"; strip the trailing zeros.
 */
export function formatMinorUnits(
  value: MinorUnits,
  decimals: number = TALE_DECIMALS,
): string {
  const formatted = formatUnits(BigInt(value), decimals);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/, "") : formatted;
}

/** Formatted amount plus symbol, e.g. "1,000 TALE". */
export function formatTokenAmount(amount: ITokenAmount): string {
  const [whole, fraction] = formatMinorUnits(
    amount.amount as MinorUnits,
    amount.decimals,
  ).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${fraction ? `${grouped}.${fraction}` : grouped} ${amount.symbol}`;
}

/**
 * Parse free-form user input ("25", "1.5") into minor units.
 *
 * `parseUnits` accepts decimals, which is what we want for an input box, but it
 * throws on garbage — surface that as a friendly message. The result is always a
 * validated minor-unit string, so nothing fractional escapes into storage.
 */
export function parseTokenInput(
  input: string,
  decimals: number = TALE_DECIMALS,
): MinorUnits {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter an amount");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number");
  }
  try {
    return toMinorUnits(parseUnits(trimmed, decimals));
  } catch {
    throw new Error("Amount is not a valid token amount");
  }
}

export function makeTokenAmount(amount: MinorUnits): ITokenAmount {
  return {
    assetId: TALE_ASSET_ID,
    symbol: TALE_SYMBOL,
    decimals: TALE_DECIMALS,
    amount,
  };
}
