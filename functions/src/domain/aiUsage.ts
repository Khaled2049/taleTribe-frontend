const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads optional ?from=&to= days. Only the shape is checked here; the ledger
 * owns the range rules (order, 90-day bound) and answers 400 itself.
 */
export function parseUsageRange(query: Record<string, unknown>): { from?: string; to?: string } | null {
  const range: { from?: string; to?: string } = {};
  for (const key of ["from", "to"] as const) {
    const value = query[key];
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || !DAY.test(value)) return null;
    range[key] = value;
  }
  return range;
}

// KEEP IN SYNC with max_purchases_per_day_per_user in creditProxy's Terraform;
// Functions cannot read the usage service's configuration.
export const MAX_PURCHASES_PER_DAY = 3;
const NEW_ACCOUNT_DAYS = 7;
const NEW_ACCOUNT_RANK = 10;
const LIMIT_DAYS = 3;

export type UsageFlag = "at_daily_limit" | "new_account" | "max_top_ups";

export interface FlagInput {
  heavyDays: number;
  mostPurchasesInADay: number;
  rank: number;
  accountCreatedAt: Date | null;
}

/**
 * Patterns worth a closer look, never verdicts. heavyDays comes from the
 * ledger and approximates MAX_AI_USAGE, which counts Function calls rather
 * than model calls, so an assistant run can count several times.
 */
export function usageFlags(input: FlagInput, now = new Date()): UsageFlag[] {
  const flags: UsageFlag[] = [];
  if (input.heavyDays >= LIMIT_DAYS) flags.push("at_daily_limit");
  if (
    input.accountCreatedAt &&
    input.rank < NEW_ACCOUNT_RANK &&
    now.getTime() - input.accountCreatedAt.getTime() < NEW_ACCOUNT_DAYS * 86_400_000
  ) {
    flags.push("new_account");
  }
  if (input.mostPurchasesInADay >= MAX_PURCHASES_PER_DAY) flags.push("max_top_ups");
  return flags;
}

export function parseSort(value: unknown): "credits" | "requests" | null {
  if (value === undefined || value === "") return "credits";
  return value === "credits" || value === "requests" ? value : null;
}

/** A Firebase uid as a single safe path segment. */
export function isUid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
