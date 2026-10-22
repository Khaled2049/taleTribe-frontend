import api, { getApiErrorMessage } from "./index";
import type { PlatformToday, UsageDay } from "@/lib/aiUsage";

export interface AiUsageSummary {
  today: PlatformToday;
  daily: { from: string; to: string; days: UsageDay[] };
}

export type UsageFlag = "at_daily_limit" | "new_account" | "max_top_ups";

export interface TopUser {
  userId: string;
  platformRequests: number;
  byokRequests: number;
  failedRequests: number;
  credits: number;
  tokens: number;
  purchasedCredits: number;
  activeDays: number;
  peakDayRequests: number;
  heavyDays: number;
  mostPurchasesInADay: number;
  accountCreatedAt: string | null;
  byokConfigured: boolean;
  flags: UsageFlag[];
}

export interface UserAiUsage {
  usage: {
    userId: string;
    from: string;
    to: string;
    days: UsageDay[];
    purchases: { at: string; credits: number }[];
  };
  balance: { hasBalance: boolean; availableCredits: number };
  dailyLimit: number;
  accountCreatedAt: string | null;
  byokConfigured: boolean;
}

async function get<T>(
  path: string,
  params: Record<string, string>,
  fallback: string,
) {
  try {
    const { data } = await api.get<T>(path, { params });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, fallback));
  }
}

/** Usage lives in creditProxy, reached only through admin-only Functions. */
export const adminAiUsageService = {
  summary: (from: string, to: string) =>
    get<AiUsageSummary>(
      "/aiUsageSummary",
      { from, to },
      "Could not load AI usage",
    ),
  topUsers: (from: string, to: string, sort: "credits" | "requests") =>
    get<{ dailyLimit: number; users: TopUser[] }>(
      "/aiUsageUsers",
      { from, to, sort },
      "Could not load top users",
    ),
  user: (uid: string, from: string, to: string) =>
    get<UserAiUsage>(
      "/aiUsageUser",
      { uid, from, to },
      "Could not load this member's AI usage",
    ),
};
