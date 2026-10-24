import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useProfileNames } from "@/hooks/queries/useUserQueries";
import {
  adminInviteService,
  type AdminInvite,
  type InviteStatus,
} from "@/cloudFunctions/adminInvites";
import { AdminSelect } from "./AdminSelect";

const control =
  "rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50";
const statusNames: Record<InviteStatus, string> = {
  pending: "Pending",
  approved: "Approved, sending email",
  sent: "Email sent",
  completed: "Joined",
  rejected: "Rejected",
};
const dateLabel = (date: string | null) =>
  date ? new Date(date).toLocaleString() : "—";

function InviteRows({
  invites,
  busyEmail,
  onReview,
}: {
  invites: AdminInvite[];
  busyEmail: string | null;
  onReview: (email: string, decision: "approve" | "reject") => void;
}) {
  const names = useProfileNames(
    invites.map((invite) => invite.reviewedBy ?? undefined),
  );
  return invites.map((invite) => {
    const busy = busyEmail === invite.email;
    return (
      <tr key={invite.email} className="border-b border-ns-border">
        <td className="break-all py-5 pr-6 font-semibold select-all">
          {invite.email}
        </td>
        <td className="whitespace-nowrap py-5 pr-6 text-ns-ink-secondary">
          {dateLabel(invite.requestedAt)}
        </td>
        <td className="whitespace-nowrap py-5 pr-6">
          {statusNames[invite.status] ?? invite.status}
        </td>
        <td className="py-5 pr-6 text-ns-ink-secondary">
          {invite.reviewedBy
            ? `${names.get(invite.reviewedBy) || invite.reviewedBy}, ${dateLabel(invite.reviewedAt)}`
            : "—"}
        </td>
        <td className="whitespace-nowrap py-5">
          <div className="flex gap-2">
            {(invite.status === "pending" || invite.status === "rejected") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onReview(invite.email, "approve")}
                className={`${control} inline-flex items-center gap-1.5`}
              >
                <Check size={16} aria-hidden="true" /> Approve
              </button>
            )}
            {invite.status === "pending" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onReview(invite.email, "reject")}
                className={`${control} inline-flex items-center gap-1.5 text-ns-destructive`}
              >
                <X size={16} aria-hidden="true" /> Reject
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  });
}

export function InviteRequests({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<InviteStatus | "">("pending");
  const invites = useInfiniteQuery({
    queryKey: ["admin", viewerId, "invites", status],
    initialPageParam: "",
    queryFn: ({ pageParam }) => adminInviteService.list(status, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const review = useMutation({
    mutationFn: ({
      email,
      decision,
    }: {
      email: string;
      decision: "approve" | "reject";
    }) => adminInviteService.review(email, decision),
    onSuccess: (_invite, { email, decision }) => {
      toast.success(
        decision === "approve"
          ? `Approved ${email}. The invite email is on its way.`
          : `Rejected ${email}.`,
      );
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", viewerId, "invites"],
      }),
  });

  return (
    <>
      <p className="mt-3 max-w-prose text-ns-ink-secondary">
        Approving sends the person a sign-in link by email. A rejected request
        can still be approved later.
      </p>
      <label className="my-8 block text-sm">
        Status
        <AdminSelect
          className="mt-2"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as InviteStatus | "")
          }
        >
          {Object.entries(statusNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="">All requests</option>
        </AdminSelect>
      </label>
      {invites.isPending && <p role="status">Loading invite requests…</p>}
      {invites.error && (
        <div role="alert" className="my-6 text-ns-destructive">
          <p>{invites.error.message}</p>
          <button
            className={`${control} mt-3`}
            onClick={() => void invites.refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {invites.data && (
        <>
          {invites.data.pages.every((page) => page.invites.length === 0) ? (
            <p className="py-8 text-ns-ink-secondary">
              No invite requests with this status.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ns-border text-ns-ink-secondary">
                  <tr>
                    {[
                      "Email",
                      "Requested",
                      "Status",
                      "Reviewed by",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="pb-3 pr-6 font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invites.data.pages.map((page, index) => (
                    <InviteRows
                      key={index}
                      invites={page.invites}
                      busyEmail={
                        review.isPending
                          ? (review.variables?.email ?? null)
                          : null
                      }
                      onReview={(email, decision) =>
                        review.mutate({ email, decision })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {invites.hasNextPage && (
            <button
              className={`${control} mt-6`}
              disabled={invites.isFetchingNextPage}
              onClick={() => void invites.fetchNextPage()}
            >
              {invites.isFetchingNextPage ? "Loading…" : "Load more requests"}
            </button>
          )}
        </>
      )}
    </>
  );
}
