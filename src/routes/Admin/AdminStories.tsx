import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { StoryDataError } from "@novelsync/story-data-client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useProfileNames } from "@/hooks/queries/useUserQueries";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ChapterContentRenderer } from "@/routes/Story/components/reader/ChapterContentRenderer";
import { useChapterModel } from "@/routes/Story/hooks/useChapterModel";
import {
  adminStoryService,
  type AdminStoryItem,
  type AdminStoryStatus,
} from "@/services/AdminStoryService";
import { withoutForeignImages } from "./ownImages";
import { AdminSelect } from "./AdminSelect";

const control =
  "rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50";
const statusLabel = (
  story: Pick<AdminStoryItem, "published" | "completionStatus">,
) =>
  !story.published
    ? "Draft"
    : story.completionStatus === "completed"
      ? "Completed"
      : "In progress";
const dateLabel = (date: string) => new Date(date).toLocaleString();

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

function StoryReview({
  storyId,
  viewerId,
}: {
  storyId: string;
  viewerId: string;
}) {
  const queryClient = useQueryClient();
  const [chapterId, setChapterId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [reviewChanged, setReviewChanged] = useState(false);
  const story = useQuery({
    queryKey: ["admin", viewerId, "story", storyId],
    queryFn: ({ signal }) => adminStoryService.get(storyId, signal),
    enabled: !deleted,
  });
  const chapters = useQuery({
    queryKey: ["admin", viewerId, "chapters", storyId],
    queryFn: ({ signal }) => adminStoryService.chapters(storyId, signal),
    enabled: !deleted,
  });
  const selectedId = chapterId || chapters.data?.[0]?.id;
  const chapter = useQuery({
    queryKey: ["admin", viewerId, "chapter", storyId, selectedId],
    queryFn: ({ signal }) =>
      adminStoryService.chapter(storyId, selectedId!, signal),
    enabled: !!selectedId && !deleted,
  });
  const content = useMemo(
    () => withoutForeignImages(chapter.data?.content ?? ""),
    [chapter.data?.content],
  );
  const model = useChapterModel(content);
  const activeMarkRef = useRef<HTMLElement | null>(null);

  async function deleteStory() {
    if (!story.data) return false;
    try {
      await adminStoryService.delete(storyId, story.data.revision);
      setDeleted(true);
      await queryClient.cancelQueries({ queryKey: ["admin", viewerId] });
      queryClient.removeQueries({
        queryKey: ["admin", viewerId, "chapter", storyId],
      });
      queryClient.removeQueries({
        queryKey: ["admin", viewerId, "chapters", storyId],
      });
      queryClient.removeQueries({
        queryKey: ["admin", viewerId, "story", storyId],
      });
      void queryClient.invalidateQueries();
      toast.success("Story deleted");
      return true;
    } catch (error) {
      if (error instanceof StoryDataError && error.status === 409) {
        setReviewChanged(true);
        setConfirmOpen(false);
        setDeleteError(
          `${error.message}. Reload the story and review it before trying again.`,
        );
      } else {
        setDeleteError(
          error instanceof Error
            ? error.message
            : "Could not delete the story. Try again.",
        );
      }
      return false;
    }
  }

  if (deleted)
    return (
      <p role="status" className="py-12">
        Story deleted.{" "}
        <Link className="text-ns-accent underline" to="/admin/stories">
          Return to all stories
        </Link>
      </p>
    );
  if (story.isPending)
    return (
      <p role="status" className="py-12">
        Loading story…
      </p>
    );
  if (story.error)
    return (
      <QueryError error={story.error} retry={() => void story.refetch()} />
    );
  const data = story.data;

  return (
    <>
      <Link
        to="/admin/stories"
        className="mb-6 inline-flex items-center gap-2 text-sm text-ns-ink-secondary hover:text-ns-accent"
      >
        <ArrowLeft size={16} /> All stories
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ns-border pb-6">
        <div className="min-w-0">
          <p className="mb-2 text-sm text-ns-accent">{statusLabel(data)}</p>
          <h1 className="break-words font-heading text-3xl sm:text-4xl">
            {data.title}
          </h1>
          <p className="mt-2 text-ns-ink-secondary">
            By {data.authorName || "Unnamed author"}
          </p>
        </div>
        <button
          className={`${control} inline-flex items-center gap-2 text-ns-destructive`}
          disabled={reviewChanged}
          onClick={() => {
            setDeleteError("");
            setConfirmOpen(true);
          }}
        >
          <Trash2 size={16} /> Delete story
        </button>
      </div>
      <dl className="my-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ns-ink-secondary">Story ID</dt>
          <dd className="mt-1 break-all select-all">{data.id}</dd>
        </div>
        <div>
          <dt className="text-ns-ink-secondary">Author ID</dt>
          <dd className="mt-1 break-all select-all">{data.ownerId}</dd>
        </div>
        <div>
          <dt className="text-ns-ink-secondary">Created</dt>
          <dd className="mt-1">{dateLabel(data.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-ns-ink-secondary">Last updated</dt>
          <dd className="mt-1">{dateLabel(data.updatedAt)}</dd>
        </div>
      </dl>
      {data.description && (
        <p className="mb-8 max-w-prose whitespace-pre-wrap text-ns-ink-secondary">
          {data.description}
        </p>
      )}
      {deleteError && (
        <div role="alert" className="mb-6 text-ns-destructive">
          <p>{deleteError}</p>
          {reviewChanged && (
            <button
              className={`${control} mt-2`}
              onClick={async () => {
                const results = await Promise.all([
                  story.refetch(),
                  chapters.refetch(),
                  ...(selectedId ? [chapter.refetch()] : []),
                ]);
                if (results.every((result) => !result.error)) {
                  setReviewChanged(false);
                  setDeleteError("");
                }
              }}
            >
              Reload story
            </button>
          )}
        </div>
      )}
      <div className="grid items-start gap-8 border-t border-ns-border pt-6 md:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Story chapters">
          <h2 className="mb-3 font-ui font-semibold">Chapters</h2>
          {chapters.isPending && <p role="status">Loading chapters…</p>}
          {chapters.error && (
            <QueryError
              error={chapters.error}
              retry={() => void chapters.refetch()}
            />
          )}
          {chapters.data?.length === 0 && (
            <p className="text-sm text-ns-ink-secondary">
              This story has no chapters.
            </p>
          )}
          <ol className="space-y-1">
            {chapters.data?.map((item, index) => (
              <li key={item.id}>
                <button
                  onClick={() => setChapterId(item.id)}
                  aria-current={selectedId === item.id ? "true" : undefined}
                  className={`w-full rounded-ns px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-ns-accent ${selectedId === item.id ? "bg-ns-surface text-ns-accent" : "hover:bg-ns-surface"}`}
                >
                  <span className="block break-words">
                    {index + 1}. {item.title}
                  </span>
                  <span className="mt-1 block text-xs text-ns-ink-secondary">
                    {item.publishedAt ? "Published" : "Draft"} ·{" "}
                    {item.wordCount.toLocaleString()} words
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0 max-w-prose break-words">
          {selectedId && chapter.isPending && (
            <p role="status">Loading content…</p>
          )}
          {chapter.error && (
            <QueryError
              error={chapter.error}
              retry={() => void chapter.refetch()}
            />
          )}
          {chapter.data && (
            <>
              <h2 className="mb-6 font-heading text-2xl">
                {chapter.data.title}
              </h2>
              {chapter.data.content ? (
                <div className="font-body text-lg leading-relaxed">
                  <ChapterContentRenderer
                    model={model}
                    marks={[]}
                    activeMarkRef={activeMarkRef}
                    paragraphStyle={data.paragraphStyle}
                    onWordClick={() => {}}
                    onHighlightClick={() => {}}
                  />
                </div>
              ) : (
                <p className="text-ns-ink-secondary">This chapter is empty.</p>
              )}
            </>
          )}
        </article>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this story?"
        description={`Permanently delete “${data.title}” and all its chapters and associated story data. This cannot be undone.`}
        confirmLabel="Delete story"
        variant="danger"
        onConfirm={deleteStory}
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

function StoryTableRows({
  stories,
  onDelete,
}: {
  stories: AdminStoryItem[];
  onDelete: (story: AdminStoryItem) => void;
}) {
  // Each page has at most 24 stories, within the profile API's batch limit.
  const usernames = useProfileNames(stories.map((story) => story.ownerId));
  return stories.map((story) => (
    <tr
      key={story.id}
      className="border-b border-ns-border hover:bg-ns-surface"
    >
      <td className="py-5 pr-6 text-ns-ink-secondary">
        {usernames.get(story.ownerId) || "Not set"}
      </td>
      <td className="min-w-[12rem] max-w-md py-5 pr-6">
        <Link
          className="font-ui font-semibold text-ns-ink underline-offset-4 hover:text-ns-accent hover:underline"
          to={`/admin/stories/${story.id}`}
        >
          {story.title}
        </Link>
      </td>
      <td className="min-w-[14rem] max-w-xs break-all py-5 pr-6 text-ns-ink-secondary select-all">
        {story.ownerId}
      </td>
      <td className="whitespace-nowrap py-5 pr-6">{statusLabel(story)}</td>
      <td className="whitespace-nowrap py-5 pr-6">
        {dateLabel(story.updatedAt)}
      </td>
      <td className="py-5">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-ns text-ns-destructive hover:bg-ns-destructive/10 hover:text-ns-destructive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-destructive"
          aria-label={`Delete story: ${story.title}`}
          title="Delete story"
          onClick={() => onDelete(story)}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </td>
    </tr>
  ));
}

function StoryList({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(params.get("q")?.trim() ?? "");
  const [status, setStatus] = useState<AdminStoryStatus>("");
  const [deleteTarget, setDeleteTarget] = useState<AdminStoryItem | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const stories = useInfiniteQuery({
    queryKey: ["admin", viewerId, "stories", search, status],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      adminStoryService.list(search, status, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
  });
  function findStory(event: FormEvent) {
    event.preventDefault();
    setSearch(input.trim());
  }
  async function deleteStory() {
    if (!deleteTarget) return false;
    try {
      await adminStoryService.delete(deleteTarget.id, deleteTarget.revision);
      await queryClient.cancelQueries({ queryKey: ["admin", viewerId] });
      queryClient.setQueriesData<
        InfiniteData<Awaited<ReturnType<typeof adminStoryService.list>>>
      >({ queryKey: ["admin", viewerId, "stories"] }, (previous) =>
        previous
          ? {
              ...previous,
              pages: previous.pages.map((page) => ({
                ...page,
                stories: page.stories.filter(
                  (story) => story.id !== deleteTarget.id,
                ),
              })),
            }
          : previous,
      );
      for (const scope of ["story", "chapters", "chapter"]) {
        queryClient.removeQueries({
          queryKey: ["admin", viewerId, scope, deleteTarget.id],
        });
      }
      setDeleteTarget(null);
      setDeleteError("");
      void queryClient.invalidateQueries();
      toast.success("Story deleted");
      return true;
    } catch (error) {
      if (error instanceof StoryDataError && error.status === 409) {
        setDeleteTarget(null);
        setDeleteError(
          `${error.message}. Refreshing the list; review the story before trying again.`,
        );
        void stories.refetch();
      } else {
        setDeleteError(
          error instanceof Error
            ? error.message
            : "Could not delete the story. Try again.",
        );
      }
      return false;
    }
  }
  return (
    <>
      <h1 className="font-heading text-3xl sm:text-4xl">Story moderation</h1>
      <p className="mt-3 max-w-prose text-ns-ink-secondary">
        Review stories and their chapters to investigate reports. Drafts are
        included.
      </p>
      <form
        onSubmit={findStory}
        className="my-8 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-[200px] flex-1 text-sm">
          Find a story
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={120}
            placeholder="Title, author name, story ID or author ID"
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
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as AdminStoryStatus)
            }
          >
            <option value="">All stories</option>
            <option value="draft">Drafts</option>
            <option value="ongoing">In progress</option>
            <option value="completed">Completed</option>
          </AdminSelect>
        </label>
      </form>
      {stories.isPending && <p role="status">Loading stories…</p>}
      {deleteError && !deleteTarget && (
        <p role="alert" className="mb-4 text-ns-destructive">
          {deleteError}
        </p>
      )}
      {stories.error && (
        <QueryError
          error={stories.error}
          retry={() => void stories.refetch()}
        />
      )}
      {stories.data && (
        <>
          {stories.data.pages.every((page) => page.stories.length === 0) ? (
            <p className="py-8 text-ns-ink-secondary">
              No stories found. Try another title, ID or status.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ns-border text-ns-ink-secondary">
                  <tr>
                    <th scope="col" className="pb-3 pr-6 font-medium">
                      Username
                    </th>
                    <th scope="col" className="pb-3 pr-6 font-medium">
                      Story name
                    </th>
                    <th scope="col" className="pb-3 pr-6 font-medium">
                      User ID
                    </th>
                    <th scope="col" className="pb-3 pr-6 font-medium">
                      Status
                    </th>
                    <th scope="col" className="pb-3 pr-6 font-medium">
                      Updated
                    </th>
                    <th scope="col" className="pb-3 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stories.data.pages.map((page, index) => (
                    <StoryTableRows
                      key={index}
                      stories={page.stories}
                      onDelete={(story) => {
                        setDeleteError("");
                        setDeleteTarget(story);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {stories.hasNextPage && (
            <button
              className={`${control} mt-6`}
              disabled={stories.isFetchingNextPage}
              onClick={() => void stories.fetchNextPage()}
            >
              {stories.isFetchingNextPage ? "Loading…" : "Load more stories"}
            </button>
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
        title="Delete this story?"
        description={`Permanently delete “${deleteTarget?.title ?? ""}” and all its chapters and associated story data. This cannot be undone.`}
        confirmLabel="Delete story"
        variant="danger"
        onConfirm={deleteStory}
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

export default function AdminStories() {
  const { storyId } = useParams();
  const { user } = useAuthContext();
  return (
    <>
      <Helmet>
        <title>Story moderation | TheTaleTribe</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      {storyId ? (
        <StoryReview
          key={`${user!.uid}:${storyId}`}
          storyId={storyId}
          viewerId={user!.uid}
        />
      ) : (
        <StoryList viewerId={user!.uid} />
      )}
    </>
  );
}
