/** Admin AI usage summary: today's standing against the platform caps and a daily series. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Response } from "express";
import { requireAdmin } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import { CreditProxyError, getCreditProxyAdmin } from "../creditProxy/transport";
import { isUid, parseSort, parseUsageRange, usageFlags } from "../domain/aiUsage";
import { getDailyAiQuotaLimit } from "../domain/aiSettings";
import { getAiSuspensions } from "../domain/aiSuspension";

const TOP_USERS = 25;

interface LedgerUser {
  userId: string;
  heavyDays: number;
  mostPurchasesInADay: number;
  [key: string]: unknown;
}

function usageError(response: Response, error: unknown, context: Record<string, unknown>) {
  if (error instanceof CreditProxyError && error.status === 400) {
    response.status(400).json({ error: "The range must run forward and cover at most 90 days" });
    return;
  }
  logger.error("AI usage request failed", { ...context, error });
  response.status(502).json({ error: "AI usage is unavailable right now" });
}

/** Account creation time, BYOK flag and any AI suspension for up to 100 users, by uid. */
async function accounts(uids: string[]) {
  const [auth, docs, suspensions] = await Promise.all([
    uids.length ? getAuth().getUsers(uids.map((uid) => ({ uid }))) : Promise.resolve({ users: [] }),
    uids.length
      ? getFirestore().getAll(...uids.map((uid) => getFirestore().collection("users").doc(uid)))
      : Promise.resolve([]),
    getAiSuspensions(uids),
  ]);
  const created = new Map(auth.users.map((user) => [user.uid, new Date(user.metadata.creationTime)]));
  const byok = new Map(docs.map((doc) => [doc.id, doc.get("hasCustomAiProvider") === true]));
  return { created, byok, suspensions };
}

/** GET /aiUsageSummary?from=YYYY-MM-DD&to=YYYY-MM-DD → { today, daily } */
const handleAiUsageSummary = requireAdmin(async (request, response, adminId, idToken) => {
  if (request.method !== "GET") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const range = parseUsageRange(request.query as Record<string, unknown>);
  if (!range) {
    response.status(400).json({ error: "from and to must be YYYY-MM-DD" });
    return;
  }
  const params = new URLSearchParams(range as Record<string, string>).toString();
  try {
    const [today, daily] = await Promise.all([
      getCreditProxyAdmin("/v1/admin/platform/today", idToken),
      getCreditProxyAdmin(`/v1/admin/usage/daily${params ? `?${params}` : ""}`, idToken),
    ]);
    response.set("Cache-Control", "no-store").status(200).json({ today, daily });
  } catch (error) {
    usageError(response, error, { adminId });
  }
});

/** GET /aiUsageUsers?from=&to=&sort=credits|requests → { users } with flags. */
const handleAiUsageUsers = requireAdmin(async (request, response, adminId, idToken) => {
  if (request.method !== "GET") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const range = parseUsageRange(request.query as Record<string, unknown>);
  const sort = parseSort(request.query.sort);
  if (!range || !sort) {
    response.status(400).json({ error: "from and to must be YYYY-MM-DD; sort must be credits or requests" });
    return;
  }
  const params = new URLSearchParams({
    ...(range as Record<string, string>),
    sort,
    limit: String(TOP_USERS),
    dailyLimit: String(getDailyAiQuotaLimit()),
  });
  try {
    const { users } = await getCreditProxyAdmin<{ users: LedgerUser[] }>(
      `/v1/admin/usage/users?${params}`,
      idToken,
    );
    // The ledger's "platform" id and test ids are not accounts; skip them here.
    const { created, byok, suspensions } = await accounts(users.map((u) => u.userId).filter(isUid));
    response.set("Cache-Control", "no-store").status(200).json({
      dailyLimit: getDailyAiQuotaLimit(),
      users: users.map((user, rank) => ({
        ...user,
        accountCreatedAt: created.get(user.userId)?.toISOString() ?? null,
        byokConfigured: byok.get(user.userId) ?? false,
        suspension: suspensions.get(user.userId) ?? null,
        flags: usageFlags({
          heavyDays: user.heavyDays,
          mostPurchasesInADay: user.mostPurchasesInADay,
          rank,
          accountCreatedAt: created.get(user.userId) ?? null,
        }),
      })),
    });
  } catch (error) {
    usageError(response, error, { adminId });
  }
});

/** GET /aiUsageUser?uid=&from=&to= → one user's usage, balance and account facts. */
const handleAiUsageUser = requireAdmin(async (request, response, adminId, idToken) => {
  if (request.method !== "GET") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const uid = request.query.uid;
  const range = parseUsageRange(request.query as Record<string, unknown>);
  if (!isUid(uid) || !range) {
    response.status(400).json({ error: "uid is required; from and to must be YYYY-MM-DD" });
    return;
  }
  // One user's usage is personal data: record who looked, the way story-data's
  // admin_audit records draft reads.
  logger.info("Admin viewed user AI usage", { adminId, targetId: uid });
  const params = new URLSearchParams(range as Record<string, string>).toString();
  try {
    const [usage, balance, account] = await Promise.all([
      getCreditProxyAdmin(`/v1/admin/usage/users/${encodeURIComponent(uid)}${params ? `?${params}` : ""}`, idToken),
      getCreditProxyAdmin(`/v1/admin/users/${encodeURIComponent(uid)}/balance`, idToken),
      accounts([uid]),
    ]);
    response.set("Cache-Control", "no-store").status(200).json({
      usage,
      balance,
      dailyLimit: getDailyAiQuotaLimit(),
      accountCreatedAt: account.created.get(uid)?.toISOString() ?? null,
      byokConfigured: account.byok.get(uid) ?? false,
      suspension: account.suspensions.get(uid) ?? null,
    });
  } catch (error) {
    usageError(response, error, { adminId, targetId: uid });
  }
});

export const aiUsageSummary = onRequest(corsOptions, handleAiUsageSummary);
export const aiUsageUsers = onRequest(corsOptions, handleAiUsageUsers);
export const aiUsageUser = onRequest(corsOptions, handleAiUsageUser);
