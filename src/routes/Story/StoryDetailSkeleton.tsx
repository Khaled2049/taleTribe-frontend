const pulse = "animate-pulse rounded bg-ns-surface";

const SYNOPSIS_LINES = ["w-full", "w-11/12", "w-2/3"];

export function StoryDetailSkeleton() {
  return (
    <div
      className="min-h-screen bg-ns-bg font-body"
      role="status"
      aria-label="Loading story"
    >
      <div
        className="max-w-5xl mx-auto px-6 pt-28 pb-10 border-b border-ns-border"
        aria-hidden="true"
      >
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
          <div className="flex-shrink-0 w-36 sm:w-44 aspect-[2/3] rounded-ns-lg animate-pulse bg-ns-surface self-start" />
          <div className="flex-1 min-w-0 pt-1 w-full">
            <div className="flex flex-wrap gap-2 mb-5">
              {["w-16", "w-20", "w-14"].map((width) => (
                <div
                  key={width}
                  className={`h-[18px] ${width} animate-pulse rounded-full bg-ns-surface`}
                />
              ))}
            </div>
            <div className="mb-5 space-y-1.5 sm:space-y-0">
              <div className={`h-10 sm:h-14 md:h-16 w-3/4 ${pulse}`} />
              <div className={`h-10 w-1/2 sm:hidden ${pulse}`} />
            </div>
            <div className="flex items-center h-5 mb-6">
              <div className={`h-3.5 w-64 max-w-full ${pulse}`} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-10 w-32 animate-pulse rounded-ns bg-ns-surface" />
              <div className="h-10 w-24 animate-pulse rounded-ns bg-ns-surface" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12" aria-hidden="true">
        <div className="max-w-2xl mx-auto">
          <section className="mb-10">
            <div className="flex items-center h-[15px] mb-4">
              <div className={`h-2.5 w-16 ${pulse}`} />
            </div>
            {SYNOPSIS_LINES.map((width, index) => (
              <div key={index} className="flex items-center h-[26px]">
                <div className={`h-4 ${width} ${pulse}`} />
              </div>
            ))}
          </section>

          <div className="flex items-center gap-4 my-10">
            <div className="flex-1 h-px bg-ns-border" />
            <div className="flex-1 h-px bg-ns-border" />
          </div>

          <section className="mb-10">
            <div className="flex items-center h-[15px] mb-5">
              <div className={`h-2.5 w-24 ${pulse}`} />
            </div>
            <div className="flex gap-5 items-start">
              <div className="w-14 h-14 rounded-full animate-pulse bg-ns-surface flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className={`h-3.5 w-32 ${pulse}`} />
                <div className={`h-3.5 w-full ${pulse}`} />
                <div className={`h-3.5 w-3/4 ${pulse}`} />
              </div>
            </div>
            <div className="mt-5 h-[30px] w-40 animate-pulse rounded-ns bg-ns-surface" />
          </section>
        </div>
      </div>
    </div>
  );
}
