import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuthContext } from "@/contexts/AuthContext";
import { useProfileNames } from "@/hooks/queries/useUserQueries";
import { formatTokenAmount } from "@/lib/money";
import {
  adminCompetitionService,
  type AdminCompetition,
} from "@/services/AdminCompetitionService";
import { AdminSelect } from "./AdminSelect";
import {
  AWAITING_SETTLEMENT,
  awaitingSettlementFor,
} from "./competitionStatus";

const control =
  "rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50";
const phaseNames = {
  draft: "Draft",
  scheduled: "Scheduled",
  open: "Open",
  voting: "Voting",
  settling: "Settling",
  settled: "Settled",
  cancelled: "Cancelled",
};
const dateLabel = (date: string | null) =>
  date ? new Date(date).toLocaleString() : "Not scheduled";

function QueryError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="my-6 text-ns-destructive">
      <p>{error.message}</p>
      <button className={`${control} mt-3`} onClick={retry}>
        Try again
      </button>
    </div>
  );
}

function CompetitionStatus({ competition }: { competition: AdminCompetition }) {
  const overdue = awaitingSettlementFor(
    competition.phase,
    competition.votingDeadline,
  );
  if (!overdue) return <>{phaseNames[competition.phase]}</>;
  return (
    <span className="font-semibold text-ns-accent">
      Awaiting settlement
      <span className="block text-xs font-normal text-ns-ink-secondary">
        Voting closed {overdue} ago
      </span>
    </span>
  );
}

function CompetitionRows({
  competitions,
  onDelete,
}: {
  competitions: AdminCompetition[];
  onDelete: (competition: AdminCompetition) => void;
}) {
  const names = useProfileNames(
    competitions.map((competition) => competition.creatorId),
  );
  return competitions.map((competition) => (
    <tr
      key={competition.id}
      className="border-b border-ns-border hover:bg-ns-surface"
    >
      <td className="py-5 pr-6 text-ns-ink-secondary">
        {names.get(competition.creatorId) || "Not set"}
      </td>
      <td className="min-w-[12rem] max-w-md py-5 pr-6">
        <Link
          to={`/admin/competitions/${competition.id}`}
          className="font-semibold underline-offset-4 hover:text-ns-accent hover:underline"
        >
          {competition.title}
        </Link>
      </td>
      <td className="min-w-[14rem] max-w-xs break-all py-5 pr-6 text-ns-ink-secondary select-all">
        {competition.creatorId}
      </td>
      <td className="whitespace-nowrap py-5 pr-6">
        <CompetitionStatus competition={competition} />
      </td>
      <td className="whitespace-nowrap py-5 pr-6">
        {dateLabel(competition.deadline)}
      </td>
      <td className="py-5">
        {competition.phase === "draft" && (
          <button
            type="button"
            onClick={() => onDelete(competition)}
            aria-label={`Delete competition: ${competition.title}`}
            title="Delete draft competition"
            className="inline-flex h-10 w-10 items-center justify-center rounded-ns text-ns-destructive hover:bg-ns-destructive/10 hover:text-ns-destructive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-destructive"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
  ));
}

function CompetitionList({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminCompetition | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");
  const competitions = useInfiniteQuery({
    queryKey: ["admin", viewerId, "competitions", search, phase],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      adminCompetitionService.list(search, phase, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
  });
  function findCompetition(event: FormEvent) {
    event.preventDefault();
    setSearch(input.trim());
  }
  async function deleteDraft() {
    if (!deleteTarget) return false;
    try {
      await adminCompetitionService.deleteDraft(deleteTarget.id);
      await queryClient.cancelQueries({
        queryKey: ["admin", viewerId, "competitions"],
      });
      queryClient.setQueriesData<
        InfiniteData<Awaited<ReturnType<typeof adminCompetitionService.list>>>
      >({ queryKey: ["admin", viewerId, "competitions"] }, (previous) =>
        previous
          ? {
              ...previous,
              pages: previous.pages.map((page) => ({
                ...page,
                competitions: page.competitions.filter(
                  (competition) => competition.id !== deleteTarget.id,
                ),
              })),
            }
          : previous,
      );
      queryClient.removeQueries({
        queryKey: ["admin", viewerId, "competition", deleteTarget.id],
      });
      void queryClient.invalidateQueries();
      toast.success("Competition draft deleted");
      setDeleteTarget(null);
      return true;
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Could not delete the draft. Try again.",
      );
      void competitions.refetch();
      return false;
    }
  }
  return (
    <>
      <h1 className="font-heading text-3xl sm:text-4xl">
        Competition moderation
      </h1>
      <p className="mt-3 max-w-prose text-ns-ink-secondary">
        Review competitions from every host, including drafts. Published
        competitions keep their cancellation and refund history.
      </p>
      <form
        onSubmit={findCompetition}
        className="my-8 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-[200px] flex-1 text-sm">
          Find a competition
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={120}
            placeholder="Title, username, competition ID or user ID"
            className={`${control} mt-2 block w-full`}
          />
        </label>
        <button
          className={`${control} inline-flex items-center gap-2`}
          type="submit"
        >
          <Search size={16} /> Search
        </button>
        <label className="text-sm">
          Status
          <AdminSelect
            className="mt-2"
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            <option value="">All competitions</option>
            {Object.entries(phaseNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value={AWAITING_SETTLEMENT}>Awaiting settlement</option>
          </AdminSelect>
        </label>
      </form>
      {competitions.isPending && <p role="status">Loading competitions…</p>}
      {competitions.error && (
        <QueryError
          error={competitions.error}
          retry={() => void competitions.refetch()}
        />
      )}
      {competitions.data && (
        <>
          {competitions.data.pages.every(
            (page) => page.competitions.length === 0,
          ) ? (
            <p className="py-8 text-ns-ink-secondary">
              No competitions found. Try another title, ID or status.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ns-border text-ns-ink-secondary">
                  <tr>
                    {[
                      "Username",
                      "Competition name",
                      "User ID",
                      "Status",
                      "Entries close",
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
                  {competitions.data.pages.map((page, index) => (
                    <CompetitionRows
                      key={index}
                      competitions={page.competitions}
                      onDelete={(competition) => {
                        setDeleteError("");
                        setDeleteTarget(competition);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {competitions.hasNextPage && (
            <button
              className={`${control} mt-6`}
              disabled={competitions.isFetchingNextPage}
              onClick={() => void competitions.fetchNextPage()}
            >
              {competitions.isFetchingNextPage
                ? "Loading…"
                : "Load more competitions"}
            </button>
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this competition draft?"
        description={`Permanently delete “${deleteTarget?.title ?? ""}”. This cannot be undone. Only unpublished drafts can be deleted.`}
        confirmLabel="Delete draft"
        variant="danger"
        onConfirm={deleteDraft}
      >
        {deleteError && (
          <p role="alert" className="text-sm text-ns-destructive">
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function CompetitionReview({ id, viewerId }: { id: string; viewerId: string }) {
  const competition = useQuery({
    queryKey: ["admin", viewerId, "competition", id],
    queryFn: ({ signal }) => adminCompetitionService.get(id, signal),
  });
  const names = useProfileNames([competition.data?.creatorId]);
  if (competition.isPending) return <p role="status">Loading competition…</p>;
  if (competition.error)
    return (
      <QueryError
        error={competition.error}
        retry={() => void competition.refetch()}
      />
    );
  const data = competition.data;
  return (
    <>
      <Link
        to="/admin/competitions"
        className="mb-6 inline-flex items-center gap-2 text-sm text-ns-ink-secondary hover:text-ns-accent"
      >
        <ArrowLeft size={16} /> All competitions
      </Link>
      <p className="mb-2 text-sm text-ns-accent">
        <CompetitionStatus competition={data} />
      </p>
      <h1 className="break-words font-heading text-3xl sm:text-4xl">
        {data.title}
      </h1>
      <p className="mt-2 text-ns-ink-secondary">
        Hosted by {names.get(data.creatorId) || data.creatorName}
      </p>
      {awaitingSettlementFor(data.phase, data.votingDeadline) && (
        <p className="mt-4 max-w-prose rounded-ns border border-ns-border bg-ns-surface p-4 text-sm text-ns-ink-secondary">
          Voting has closed but nobody has opened this competition since, so it
          has not settled and the winner has not been paid. Opening the
          competition page settles it.
        </p>
      )}
      <dl className="my-6 grid gap-4 border-y border-ns-border py-6 text-sm sm:grid-cols-2">
        {[
          ["Competition ID", data.id],
          ["User ID", data.creatorId],
          ["Starts", dateLabel(data.startDate)],
          ["Entries close", dateLabel(data.deadline)],
          ["Voting closes", dateLabel(data.votingDeadline)],
          ["Prize pool", formatTokenAmount(data.prizePool)],
          ["Entry fee", formatTokenAmount(data.entryFee)],
          ["Participants", data.participants],
          ["Submissions", data.submissionCount],
          ["Ballots cast", data.ballotCount],
          ["Category", data.category || "Not set"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-ns-ink-secondary">{label}</dt>
            <dd className="mt-1 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mb-3 font-heading text-2xl">Description</h2>
      <p className="max-w-prose whitespace-pre-wrap text-ns-ink-secondary">
        {data.description || "No description yet."}
      </p>
      {data.tags.length > 0 && (
        <p className="mt-6 text-sm text-ns-ink-secondary">
          Tags: {data.tags.join(", ")}
        </p>
      )}
      {data.phase !== "draft" && (
        <Link
          to={`/competitions/${data.id}`}
          className="mt-8 inline-block text-ns-accent underline"
        >
          Open competition
        </Link>
      )}
    </>
  );
}

export default function AdminCompetitions() {
  const { competitionId } = useParams();
  const { user } = useAuthContext();
  return (
    <>
      <Helmet>
        <title>Competition moderation | TheTaleTribe</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      {competitionId ? (
        <CompetitionReview
          key={competitionId}
          id={competitionId}
          viewerId={user!.uid}
        />
      ) : (
        <CompetitionList viewerId={user!.uid} />
      )}
    </>
  );
}
