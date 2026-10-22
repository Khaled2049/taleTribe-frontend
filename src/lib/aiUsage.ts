export interface UsageDay {
  day: string;
  platformRequests: number;
  byokRequests: number;
  failedRequests: number;
  unknownUsageRequests: number;
  credits: number;
  promptTokens: number;
  completionTokens: number;
  purchasedCredits: number;
  activeUsers: number;
}

export interface PlatformToday {
  day: string;
  requests: number;
  requestLimit: number;
  credits: number;
  creditLimit: number;
  resetsAt: string;
}

const DAY_MS = 86_400_000;

/** The inclusive UTC day range ending today, matching how the ledger buckets days. */
export function utcRange(days: number, now = new Date()) {
  const to = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

// Before this share of the UTC day has passed, a straight-line projection is
// mostly noise from the first few requests.
const MIN_PROJECTION_FRACTION = 0.05;

/** Today's count extrapolated to midnight UTC at the pace so far, or null when it is too early to say. */
export function projectToMidnight(
  used: number,
  now = new Date(),
): number | null {
  const elapsed = (now.getTime() % DAY_MS) / DAY_MS;
  if (elapsed < MIN_PROJECTION_FRACTION) return null;
  return Math.round(used / elapsed);
}

export type MeterLevel = "normal" | "warning" | "critical";

export function meterLevel(used: number, limit: number): MeterLevel {
  if (limit <= 0 || used >= limit) return "critical";
  return used / limit >= 0.8 ? "warning" : "normal";
}

export function summarize(days: UsageDay[]) {
  const total = (pick: (day: UsageDay) => number) =>
    days.reduce((sum, day) => sum + pick(day), 0);
  const platformRequests = total((d) => d.platformRequests);
  const failedRequests = total((d) => d.failedRequests);
  return {
    platformRequests,
    byokRequests: total((d) => d.byokRequests),
    credits: total((d) => d.credits),
    tokens: total((d) => d.promptTokens + d.completionTokens),
    purchasedCredits: total((d) => d.purchasedCredits),
    unknownUsageRequests: total((d) => d.unknownUsageRequests),
    failureRate: platformRequests ? failedRequests / platformRequests : null,
  };
}

/** Round y-axis ticks (1, 2 or 5 × 10ⁿ steps) from zero to at least `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  const ticks = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick);
  return ticks;
}

/** Which day columns get an x-axis label, so at most about six labels show. */
export function labelledDays(count: number): Set<number> {
  const every = Math.max(1, Math.ceil(count / 6));
  const shown = new Set<number>();
  for (let i = count - 1; i >= 0; i -= every) shown.add(i);
  return shown;
}

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const formatCompact = (value: number) => compact.format(value);

export const number = new Intl.NumberFormat("en");
export const dayLabel = (day: string, style: "short" | "long" = "short") =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    ...(style === "long" ? { weekday: "short" } : {}),
    timeZone: "UTC",
  });
