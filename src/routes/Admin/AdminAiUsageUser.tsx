import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useAuthContext } from "@/contexts/AuthContext";
import { useProfileNames } from "@/hooks/queries/useUserQueries";
import { profilePath } from "@/lib/seoPaths";
import { adminAiUsageService } from "@/cloudFunctions/adminAiUsage";
import {
  memberUsage,
  type MemberUsageDay,
} from "@/services/AdminMemberService";
import {
  formatCompact,
  number,
  summarize,
  utcRange,
  type UsageDay,
} from "@/lib/aiUsage";
import {
  ColumnChart,
  RangePicker,
  StatTile,
  UsageTable,
  VIZ_STYLE,
  control,
  type RANGES,
} from "./usageCharts";
import type { UsageColumn } from "./usageColumns";

type Row = UsageDay & Omit<MemberUsageDay, "day">;

const COLUMNS: UsageColumn<Row>[] = [
  ["Day (UTC)", (d) => d.day],
  ["Platform", (d) => number.format(d.platformRequests)],
  ["BYOK", (d) => number.format(d.byokRequests)],
  ["Failed", (d) => number.format(d.failedRequests)],
  ["Credits", (d) => number.format(d.credits)],
  ["Tokens", (d) => number.format(d.promptTokens + d.completionTokens)],
  ["Top-ups", (d) => number.format(d.purchasedCredits)],
  ["Indexing passes", (d) => number.format(d.indexingPasses)],
  [
    "Recommendation calls",
    (d) => number.format(d.recsSearches + d.recsExplains),
  ],
];

const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function AdminAiUsageUser() {
  const { uid = "" } = useParams();
  const { user } = useAuthContext();
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(30);
  const [showTable, setShowTable] = useState(false);
  const range = useMemo(() => utcRange(rangeDays), [rangeDays]);
  const usage = useQuery({
    queryKey: ["admin", user!.uid, "ai-usage-user", uid, range.from, range.to],
    queryFn: () => adminAiUsageService.user(uid, range.from, range.to),
    placeholderData: keepPreviousData,
  });
  const local = useQuery({
    queryKey: ["admin", user!.uid, "member-usage", uid, range.from, range.to],
    queryFn: ({ signal }) => memberUsage(uid, range.from, range.to, signal),
    placeholderData: keepPreviousData,
  });
  const names = useProfileNames([uid]);
  const name = names.get(uid);

  const days = usage.data?.usage.days ?? [];
  const localByDay = new Map((local.data?.days ?? []).map((d) => [d.day, d]));
  const rows: Row[] = days.map((d) => ({
    indexingPasses: 0,
    recsSearches: 0,
    recsExplains: 0,
    ...localByDay.get(d.day),
    ...d,
  }));
  const totals = summarize(days);
  const dailyLimit = usage.data?.dailyLimit ?? 100;
  const daysAtLimit = days.filter(
    (d) => d.platformRequests >= dailyLimit,
  ).length;
  const indexing = rows.reduce((sum, r) => sum + r.indexingPasses, 0);
  const recs = rows.reduce(
    (sum, r) => sum + r.recsSearches + r.recsExplains,
    0,
  );
  const stale = usage.isPlaceholderData || local.isPlaceholderData;

  return (
    <div className="ai-usage">
      <style>{VIZ_STYLE}</style>
      <Helmet>
        <title>Member AI usage | TheTaleTribe</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <Link
        to="/admin/ai-usage"
        className="mb-6 inline-flex items-center gap-2 text-sm text-ns-ink-secondary hover:text-ns-accent"
      >
        <ArrowLeft size={16} /> All AI usage
      </Link>
      <h1 className="break-words font-heading text-3xl sm:text-4xl">
        {name ? `@${name}` : "Member"} AI usage
      </h1>
      <p className="mt-2 break-all text-sm text-ns-ink-secondary select-all">
        {uid}
      </p>
      <p className="mt-2 flex gap-4 text-sm">
        <Link to={profilePath(uid)} className="text-ns-accent underline">
          Profile
        </Link>
        <Link
          to={`/admin/stories?q=${encodeURIComponent(uid)}`}
          className="text-ns-accent underline"
        >
          Stories
        </Link>
      </p>
      <p className="mt-3 max-w-prose text-xs text-ns-ink-muted">
        Opening this page is logged with your account.
      </p>

      {usage.isPending && (
        <p role="status" className="mt-8">
          Loading this member's AI usage…
        </p>
      )}
      {usage.error && !usage.data && (
        <div role="alert" className="my-6 text-ns-destructive">
          <p>{usage.error.message}</p>
          <button
            className={`${control} mt-3`}
            onClick={() => void usage.refetch()}
          >
            Try again
          </button>
        </div>
      )}

      {usage.data && (
        <>
          <dl className="mt-8 grid gap-4 border-y border-ns-border py-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ns-ink-secondary">Account created</dt>
              <dd className="mt-1">
                {usage.data.accountCreatedAt
                  ? `${new Date(usage.data.accountCreatedAt).toLocaleDateString()} (${number.format(daysSince(usage.data.accountCreatedAt))} days ago)`
                  : "No Firebase account found"}
              </dd>
            </div>
            <div>
              <dt className="text-ns-ink-secondary">Own AI key (BYOK)</dt>
              <dd className="mt-1">
                {usage.data.byokConfigured ? "Configured" : "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-ns-ink-secondary">Credit balance</dt>
              <dd className="mt-1">
                {usage.data.balance.hasBalance
                  ? `${number.format(usage.data.balance.availableCredits)} credits`
                  : "None yet; free credits are granted on first use"}
              </dd>
            </div>
          </dl>

          <RangePicker value={rangeDays} onChange={setRangeDays}>
            {(usage.error || local.error) && (
              <span role="alert" className="text-sm text-ns-destructive">
                Could not refresh: {(usage.error ?? local.error)?.message}
              </span>
            )}
          </RangePicker>
          <div className={`transition-opacity ${stale ? "opacity-60" : ""}`}>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                label="Platform requests"
                value={formatCompact(totals.platformRequests)}
              />
              <StatTile
                label="BYOK requests"
                value={formatCompact(totals.byokRequests)}
              />
              <StatTile
                label="Credits spent"
                value={formatCompact(totals.credits)}
              />
              <StatTile label="Tokens" value={formatCompact(totals.tokens)} />
              <StatTile
                label="Days at the daily limit"
                value={number.format(daysAtLimit)}
                caption={`${number.format(dailyLimit)}+ platform requests; approximate`}
              />
              <StatTile
                label="Credits topped up"
                value={formatCompact(totals.purchasedCredits)}
              />
              <StatTile
                label="Indexing passes"
                value={local.data ? formatCompact(indexing) : "—"}
                caption="Story embedding, any key"
              />
              <StatTile
                label="Recommendation calls"
                value={local.data ? formatCompact(recs) : "—"}
              />
            </div>
            <div className="mt-6 grid gap-6">
              <ColumnChart
                title="Requests per day"
                description="This member's platform-funded and bring-your-own-key requests, by UTC day."
                days={days}
                series={[
                  {
                    label: "Platform",
                    color: "var(--series-1)",
                    values: days.map((d) => d.platformRequests),
                  },
                  {
                    label: "BYOK",
                    color: "var(--series-2)",
                    values: days.map((d) => d.byokRequests),
                  },
                ]}
              />
              <ColumnChart
                title="Credits spent per day"
                description="Platform credits committed for this member, by UTC day."
                days={days}
                series={[
                  {
                    label: "Credits",
                    color: "var(--series-1)",
                    values: days.map((d) => d.credits),
                  },
                ]}
              />
              {local.data && (
                <ColumnChart
                  title="Indexing passes per day"
                  description="Embedding passes over this member's stories, by UTC day."
                  days={rows}
                  series={[
                    {
                      label: "Indexing passes",
                      color: "var(--series-1)",
                      values: rows.map((r) => r.indexingPasses),
                    },
                  ]}
                />
              )}
            </div>

            <h2 className="mt-10 font-heading text-2xl">Top-ups</h2>
            {usage.data.usage.purchases.length === 0 ? (
              <p className="mt-2 text-ns-ink-secondary">
                No top-ups in this range.
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {usage.data.usage.purchases.map((purchase) => (
                  <li key={purchase.at}>
                    {new Date(purchase.at).toLocaleString()}:{" "}
                    <strong className="font-semibold">
                      {number.format(purchase.credits)}
                    </strong>{" "}
                    credits
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              aria-expanded={showTable}
              onClick={() => setShowTable((shown) => !shown)}
              className={`${control} mt-8`}
            >
              {showTable ? "Hide table" : "Show as table"}
            </button>
            {showTable && (
              <div className="mt-4">
                <UsageTable days={rows} columns={COLUMNS} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
