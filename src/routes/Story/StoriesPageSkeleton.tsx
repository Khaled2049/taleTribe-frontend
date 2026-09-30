import { useAuthIdentity } from "@novelsync/platform-auth";
import StoriesHeader from "@/components/story/StoriesHeader";

const PLACEHOLDER_COUNT = 12;

const pulse = "animate-pulse rounded bg-ns-surface";

const noop = () => undefined;

export function StoryGridSkeleton({ count = PLACEHOLDER_COUNT }) {
  const items = Array.from({ length: count }, (_, index) => index);
  return (
    <div aria-hidden="true">
      <div className="sm:hidden divide-y divide-ns-border border-t border-ns-border">
        {items.map((index) => (
          <div key={index} className="flex items-center gap-3 py-3">
            <div className={`w-10 h-[60px] shrink-0 ${pulse}`} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className={`h-4 w-2/3 ${pulse}`} />
              <div className={`h-3 w-1/3 ${pulse}`} />
              <div className={`h-3 w-1/4 ${pulse}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:grid sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
        {items.map((index) => (
          <div key={index}>
            <div className="max-w-[130px] mx-auto">
              <div className="aspect-[2/3] mb-2 animate-pulse rounded-ns bg-ns-surface" />
            </div>
            <div className="space-y-0.5">
              <div className="flex h-5 items-center">
                <div className={`h-3.5 w-3/4 ${pulse}`} />
              </div>
              <div className="flex h-4 items-center">
                <div className={`h-3 w-1/2 ${pulse}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoriesPageSkeleton() {
  const { uid } = useAuthIdentity();
  return (
    <div
      className="container mx-auto px-4 max-w-7xl"
      role="status"
      aria-label="Loading stories"
    >
      <div className="flex gap-8 items-start">
        <div className="flex-1 min-w-0">
          <StoriesHeader
            uid={uid}
            onNewStory={noop}
            isModalOpen={false}
            onCloseModal={noop}
          />
          <div className="mb-2 h-[41px] border-b border-ns-border" />
          <div className="mb-6 min-h-4" />
          <StoryGridSkeleton />
        </div>
        <div className="hidden lg:block w-40 shrink-0 mt-12" aria-hidden="true">
          <div className="h-9 mb-3 border-b border-ns-border" />
          <div className="space-y-3 px-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={`h-4 w-20 ${pulse}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
