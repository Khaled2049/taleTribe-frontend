import type { ReactNode } from "react";
import { number, type UsageDay } from "@/lib/aiUsage";

export type UsageColumn<T> = [string, (day: T) => ReactNode];

export const USAGE_COLUMNS: UsageColumn<UsageDay>[] = [
  ["Day (UTC)", (d) => d.day],
  ["Platform", (d) => number.format(d.platformRequests)],
  ["BYOK", (d) => number.format(d.byokRequests)],
  ["Failed", (d) => number.format(d.failedRequests)],
  ["Usage unknown", (d) => number.format(d.unknownUsageRequests)],
  ["Credits", (d) => number.format(d.credits)],
  ["Prompt tokens", (d) => number.format(d.promptTokens)],
  ["Output tokens", (d) => number.format(d.completionTokens)],
  ["Top-ups", (d) => number.format(d.purchasedCredits)],
  ["Active users", (d) => number.format(d.activeUsers)],
];
