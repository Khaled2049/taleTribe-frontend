import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useAuthContext } from "@/contexts/AuthContext";
import { useProfileNames } from "@/hooks/queries/useUserQueries";
import {
  adminAiUsageService,
  type TopUser,
  type UsageFlag,
} from "@/cloudFunctions/adminAiUsage";
import { formatCompact, number, summarize, utcRange } from "@/lib/aiUsage";
import {
  ColumnChart,
  Meter,
  RangePicker,
  StatTile,
  UsageTable,
  VIZ_STYLE,
  control,
  type RANGES,
} from "./usageCharts";
import { USAGE_COLUMNS } from "./usageColumns";

const FLAG_LABELS: Record<UsageFlag, string> = {
  at_daily_limit: "Often at the daily limit",
  new_account: "New account",
  max_top_ups: "Maximum top-ups in a day",
};
const UID = /^[A-Za-z0-9_-]{1,128}$/;

function FlagBadges({ flags }: { flags: UsageFlag[] }) {
  if (!flags.length) return <span className="text-ns-ink-muted">—</span>;
  return (
    <ul className="flex flex-col gap-1">
      {flags.map((flag) => (
        <li
          key={flag}
          className="flex items-center gap-1.5 whitespace-nowrap text-ns-ink"
        >
          <AlertTriangle
            size={14}
            aria-hidden="true"
            style={{ color: "var(--meter-warning)" }}
          />
          {FLAG_LABELS[flag]}
        </li>
      ))}
    </ul>
  );
}

function TopUsers({
  viewerId,
  from,
  to,
}: {
  viewerId: string;
  from: string;
  to: string;
}) {
  const [sort, setSort] = useState<"credits" | "requests">("credits");
  const top = useQuery({
    queryKey: ["admin", viewerId, "ai-usage-users", from, to, sort],
    queryFn: () => adminAiUsageService.topUsers(from, to, sort),
    placeholderData: keepPreviousData,
  });
  const users = top.data?.users ?? [];
  const names = useProfileNames(users.map((user) => user.userId));
  const columns: [string, (user: TopUser) => ReactNode][] = [
    [
      "Member",
      (u) =>
        UID.test(u.userId) ? (
          <Link
            to={`/admin/ai-usage/users/${u.userId}`}
            className="font-semibold underline-offset-4 hover:text-ns-accent hover:underline"
          >
            {names.get(u.userId) ? `@${names.get(u.userId)}` : u.userId}
          </Link>
        ) : (
          <span className="text-ns-ink-secondary">{u.userId}</span>
        ),
    ],
    ["Platform", (u) => number.format(u.platformRequests)],
    ["BYOK", (u) => number.format(u.byokRequests)],
    ["Credits", (u) => number.format(u.credits)],
    ["Tokens", (u) => formatCompact(u.tokens)],
    ["Top-ups", (u) => number.format(u.purchasedCredits)],
    ["Days at limit", (u) => number.format(u.heavyDays)],
    ["Flags", (u) => <FlagBadges flags={u.flags} />],
  ];

  return (
    <section aria-labelledby="ai-top-users" className="mt-12">
      <h2 id="ai-top-users" className="font-heading text-2xl">
        Top users
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ns-ink-secondary">
        The 25 heaviest users in this range. "Days at limit" counts days with at
        least {number.format(top.data?.dailyLimit ?? 100)} platform requests;
        assistant runs make several requests each, so it overstates the quota
        users actually hit. Flags are prompts to look closer, not verdicts.
      </p>
      <div role="group" aria-label="Sort top users" className="mt-4 flex gap-2">
        {(["credits", "requests"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={sort === option}
            onClick={() => setSort(option)}
            className={`${control} ${sort === option ? "border-ns-accent font-semibold" : ""}`}
          >
            By {option}
          </button>
        ))}
      </div>
      {top.isPending && (
        <p role="status" className="mt-4">
          Loading top users…
        </p>
      )}
      {top.error && (
        <p role="alert" className="mt-4 text-ns-destructive">
          {top.error.message}
        </p>
      )}
      {top.data && (
        <div
          className={`mt-4 overflow-x-auto transition-opacity ${top.isPlaceholderData ? "opacity-60" : ""}`}
        >
          {users.length === 0 ? (
            <p className="py-6 text-ns-ink-secondary">
              No AI usage in this range.
            </p>
          ) : (
            <table
              className="w-full text-left text-sm"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <thead className="border-b border-ns-border text-ns-ink-secondary">
                <tr>
                  {columns.map(([label]) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap pb-3 pr-6 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.userId}
                    className="border-b border-ns-border align-top"
                  >
                    {columns.map(([label, cell]) => (
                      <td key={label} className="py-3 pr-6">
                        {cell(user)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

export default function AdminAiUsage() {
  const { user } = useAuthContext();
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(30);
  const [showTable, setShowTable] = useState(false);
  const range = useMemo(() => utcRange(rangeDays), [rangeDays]);
  const usage = useQuery({
    queryKey: ["admin", user!.uid, "ai-usage", range.from, range.to],
    queryFn: () => adminAiUsageService.summary(range.from, range.to),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const days = usage.data?.daily.days ?? [];
  const totals = summarize(days);
  const today = usage.data?.today;

  return (
    <div className="ai-usage">
      <style>{VIZ_STYLE}</style>
      <Helmet>
        <title>AI usage | TheTaleTribe</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <h1 className="font-heading text-3xl sm:text-4xl">AI usage</h1>
      <p className="mt-3 max-w-prose text-ns-ink-secondary">
        Platform-funded AI against its daily caps, and how usage has moved.
        Figures come from best-effort logging, so they can slightly undercount.
      </p>

      {usage.isPending && (
        <p role="status" className="mt-8">
          Loading AI usage…
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

      {today && (
        <section aria-labelledby="ai-today" className="mt-8">
          <h2 id="ai-today" className="font-heading text-2xl">
            Today (UTC)
          </h2>
          <p className="mt-1 text-sm text-ns-ink-secondary">
            Both caps reset at midnight UTC,{" "}
            {new Date(today.resetsAt).toLocaleTimeString("en", {
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            your time. BYOK requests never count.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Meter
              label="Platform requests"
              used={today.requests}
              limit={today.requestLimit}
              unit="requests"
            />
            <Meter
              label="Platform credits held"
              used={today.credits}
              limit={today.creditLimit}
              unit="credits"
            />
          </div>
        </section>
      )}

      {usage.data && (
        <section aria-labelledby="ai-trend" className="mt-12">
          <h2 id="ai-trend" className="font-heading text-2xl">
            Over time
          </h2>
          <RangePicker value={rangeDays} onChange={setRangeDays}>
            {usage.error && (
              <span role="alert" className="text-sm text-ns-destructive">
                Could not refresh: {usage.error.message}
              </span>
            )}
          </RangePicker>
          <div
            className={`transition-opacity ${usage.isPlaceholderData ? "opacity-60" : ""}`}
          >
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <StatTile
                label="Platform requests"
                value={formatCompact(totals.platformRequests)}
              />
              <StatTile
                label="BYOK requests"
                value={formatCompact(totals.byokRequests)}
                caption="No platform cost"
              />
              <StatTile
                label="Credits spent"
                value={formatCompact(totals.credits)}
              />
              <StatTile label="Tokens" value={formatCompact(totals.tokens)} />
              <StatTile
                label="Failure rate"
                value={
                  totals.failureRate === null
                    ? "—"
                    : `${(totals.failureRate * 100).toFixed(1)}%`
                }
                caption="Of platform requests"
              />
              <StatTile
                label="Credits topped up"
                value={formatCompact(totals.purchasedCredits)}
              />
            </div>
            <div className="mt-6 grid gap-6">
              <ColumnChart
                title="Requests per day"
                description="Platform-funded and bring-your-own-key requests, by UTC day."
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
                description="Platform credits committed, by UTC day. BYOK spends none."
                days={days}
                series={[
                  {
                    label: "Credits",
                    color: "var(--series-1)",
                    values: days.map((d) => d.credits),
                  },
                ]}
              />
            </div>
            {totals.unknownUsageRequests > 0 && (
              <p className="mt-4 text-sm text-ns-ink-secondary">
                {number.format(totals.unknownUsageRequests)} assistant requests
                ended without a usage report and were charged their full hold.
              </p>
            )}
            <button
              type="button"
              aria-expanded={showTable}
              onClick={() => setShowTable((shown) => !shown)}
              className={`${control} mt-6`}
            >
              {showTable ? "Hide table" : "Show as table"}
            </button>
            {showTable && (
              <div className="mt-4">
                <UsageTable days={days} columns={USAGE_COLUMNS} />
              </div>
            )}
          </div>
          <TopUsers viewerId={user!.uid} from={range.from} to={range.to} />
        </section>
      )}
    </div>
  );
}
