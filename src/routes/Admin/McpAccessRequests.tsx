import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useProfileNames } from "@/hooks/queries/useUserQueries";
import { profilePath } from "@/lib/seoPaths";
import {
  adminMcpAccessService,
  type McpAccessRecord,
  type McpDecision,
  type McpStatus,
} from "@/cloudFunctions/adminMcpAccess";

const control =
  "rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50";
const statusNames: Record<McpStatus, string> = {
  requested: "Requested",
  granted: "Granted",
  revoked: "Off (rejected or revoked)",
};
const dateLabel = (date: string | null) =>
  date ? new Date(date).toLocaleString() : "—";

function Rows({
  records,
  busyUid,
  onDecide,
}: {
  records: McpAccessRecord[];
  busyUid: string | null;
  onDecide: (record: McpAccessRecord, decision: McpDecision) => void;
}) {
  const names = useProfileNames(
    records.flatMap((r) => [r.uid, r.decidedBy ?? undefined]),
  );
  return records.map((record) => {
    const busy = busyUid === record.uid;
    const name = names.get(record.uid);
    return (
      <tr key={record.uid} className="border-b border-ns-border align-top">
        <td className="py-4 pr-6">
          <Link
            to={profilePath(record.uid)}
            className="font-semibold underline-offset-4 hover:text-ns-accent hover:underline"
          >
            {name ? `@${name}` : record.uid}
          </Link>
          <p className="mt-1 break-all text-ns-ink-secondary select-all">
            {record.email ?? "No Firebase account"}
          </p>
        </td>
        <td className="max-w-xs whitespace-pre-wrap break-words py-4 pr-6 text-ns-ink-secondary">
          {record.note || "—"}
        </td>
        <td className="whitespace-nowrap py-4 pr-6 text-ns-ink-secondary">
          {dateLabel(record.requestedAt)}
        </td>
        <td className="py-4 pr-6">
          {statusNames[record.status] ?? record.status}
          {record.decidedAt && (
            <p className="mt-1 text-xs text-ns-ink-muted">
              {dateLabel(record.decidedAt)}
              {record.decidedBy
                ? ` by ${names.get(record.decidedBy) ? `@${names.get(record.decidedBy)}` : "an admin"}`
                : ""}
            </p>
          )}
        </td>
        <td className="whitespace-nowrap py-4">
          <div className="flex gap-2">
            {(record.status === "requested" || record.status === "revoked") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(record, "grant")}
                className={`${control} inline-flex items-center gap-1.5`}
              >
                <Check size={16} aria-hidden="true" /> Grant
              </button>
            )}
            {record.status === "requested" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(record, "reject")}
                className={`${control} inline-flex items-center gap-1.5 text-ns-destructive`}
              >
                <X size={16} aria-hidden="true" /> Reject
              </button>
            )}
            {record.status === "granted" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(record, "revoke")}
                className={`${control} text-ns-destructive`}
              >
                Revoke
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  });
}

export function McpAccessRequests({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<McpStatus | "">("requested");
  const [revokeTarget, setRevokeTarget] = useState<McpAccessRecord | null>(
    null,
  );
  const records = useInfiniteQuery({
    queryKey: ["admin", viewerId, "mcp-access", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) => adminMcpAccessService.list(status, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const decide = useMutation({
    mutationFn: ({ uid, decision }: { uid: string; decision: McpDecision }) =>
      adminMcpAccessService.review(uid, decision),
    onSuccess: (record, { decision }) => {
      const who = record.email ?? record.uid;
      toast.success(
        decision === "grant"
          ? `Granted ${who}. They can connect within a few seconds.`
          : decision === "reject"
            ? `Rejected ${who}. They can ask again later.`
            : `Revoked ${who}. Existing connections stop within a minute.`,
      );
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", viewerId, "mcp-access"],
      }),
  });

  function onDecide(record: McpAccessRecord, decision: McpDecision) {
    if (decision === "revoke") setRevokeTarget(record);
    else decide.mutate({ uid: record.uid, decision });
  }

  return (
    <>
      <p className="mt-3 max-w-prose text-ns-ink-secondary">
        People who asked to connect Claude to their stories. Granting lets them
        connect; rejecting or revoking turns access off, and they can ask again.
        Notes are written by the requester.
      </p>
      <label className="my-8 block text-sm">
        Status
        <select
          className={`${control} mt-2 block`}
          value={status}
          onChange={(event) => setStatus(event.target.value as McpStatus | "")}
        >
          {Object.entries(statusNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="">All records</option>
        </select>
      </label>
      {records.isPending && <p role="status">Loading connector access…</p>}
      {records.error && (
        <div role="alert" className="my-6 text-ns-destructive">
          <p>{records.error.message}</p>
          <button
            className={`${control} mt-3`}
            onClick={() => void records.refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {records.data && (
        <>
          {records.data.pages.every((page) => page.records.length === 0) ? (
            <p className="py-8 text-ns-ink-secondary">
              No connector access records with this status.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ns-border text-ns-ink-secondary">
                  <tr>
                    {["Member", "Note", "Requested", "Status", "Actions"].map(
                      (label) => (
                        <th
                          key={label}
                          scope="col"
                          className="pb-3 pr-6 font-medium"
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {records.data.pages.map((page, index) => (
                    <Rows
                      key={index}
                      records={page.records}
                      busyUid={
                        decide.isPending
                          ? (decide.variables?.uid ?? null)
                          : null
                      }
                      onDecide={onDecide}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {records.hasNextPage && (
            <button
              className={`${control} mt-6`}
              disabled={records.isFetchingNextPage}
              onClick={() => void records.fetchNextPage()}
            >
              {records.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke connector access?"
        description={`${revokeTarget?.email ?? revokeTarget?.uid ?? ""} loses access to the Claude connector. Connections they already made stop working within a minute. They can ask for access again.`}
        confirmLabel="Revoke access"
        variant="danger"
        onConfirm={async () => {
          if (!revokeTarget) return false;
          try {
            await decide.mutateAsync({
              uid: revokeTarget.uid,
              decision: "revoke",
            });
            setRevokeTarget(null);
            return true;
          } catch {
            return false;
          }
        }}
      />
    </>
  );
}
