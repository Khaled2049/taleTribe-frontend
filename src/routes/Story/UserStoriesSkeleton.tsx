export function UserStoryRowSkeleton() {
  return (
    <div className="flex gap-4 border-b border-ns-border py-6 animate-pulse">
      <div className="ml-4 h-[68px] w-12 shrink-0 rounded bg-ns-surface" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="h-5 w-52 rounded bg-ns-surface" />
          <div className="h-6 w-28 shrink-0 rounded bg-ns-surface" />
        </div>
        <div className="mt-2 h-3 w-40 rounded bg-ns-surface" />
        <div className="mt-3 h-3 w-full rounded bg-ns-surface" />
        <div className="mt-3 flex gap-3">
          <div className="h-3 w-12 rounded bg-ns-surface" />
          <div className="h-3 w-12 rounded bg-ns-surface" />
        </div>
      </div>
    </div>
  );
}

export function UserStoriesSkeleton() {
  return (
    <div
      className="min-h-screen bg-ns-bg text-ns-ink"
      role="status"
      aria-label="Loading your stories"
    >
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-6 flex items-start justify-between gap-3">
          <h1 className="font-heading text-display leading-none">My Shelf</h1>
          <div
            className="h-9 w-28 rounded-ns bg-ns-surface"
            aria-hidden="true"
          />
        </div>
        <div
          className="mb-8 h-4 w-44 rounded bg-ns-surface"
          aria-hidden="true"
        />
        <div className="mb-6 flex gap-6 border-b border-ns-border pb-3 font-heading text-2xl sm:text-3xl">
          <span>My Writing</span>
          <span className="text-ns-ink-muted">Continue Reading</span>
        </div>
        <div className="divide-y divide-ns-border" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <UserStoryRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
