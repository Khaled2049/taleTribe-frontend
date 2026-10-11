import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Library, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthIdentity } from "@novelsync/platform-auth";
import {
  useClearReadingHistory,
  useRecentlyRead,
} from "@/hooks/queries/useUserQueries";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { ContinueReadingList } from "@/routes/Story/components/ContinueReadingList";

// story-data caps this endpoint at 50.
const SHELF_LIMIT = 30;

const Shelf = () => {
  const identity = useAuthIdentity();
  const uid = identity.uid ?? undefined;
  const navigate = useNavigate();
  const recentlyRead = useRecentlyRead(uid, SHELF_LIMIT);
  const clearHistory = useClearReadingHistory(uid);
  const queryClient = useQueryClient();

  // The shared hook caches for two minutes, which on a tab the reader returns
  // to straight after reading would show the chapter they started from.
  useEffect(() => {
    if (!uid) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.user.recentlyRead(uid),
    });
  }, [uid, queryClient]);

  return (
    <div className="min-h-full bg-ns-bg px-4 pb-10 pt-6 text-ns-ink">
      <h1 className="mb-6 font-heading text-display leading-none text-ns-ink">
        My Shelf
      </h1>

      {identity.loading ? (
        <div className="flex justify-center py-16">
          <Loader2
            className="h-7 w-7 animate-spin text-ns-accent"
            aria-label="Checking sign-in status"
          />
        </div>
      ) : !identity.isSignedIn ? (
        <div className="py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-ns-border bg-ns-surface">
            <Library className="h-7 w-7 text-ns-ink-muted" />
          </div>
          <h2 className="mb-2 font-heading text-2xl text-ns-ink">
            Keep your place
          </h2>
          <p className="mb-6 font-ui text-sm text-ns-ink-secondary">
            Sign in to save your reading progress and continue on any device.
          </p>
          <Link
            to="/sign-in?redirect=%2Fshelf"
            className="inline-flex items-center rounded-ns bg-ns-accent px-5 py-2.5 font-ui text-sm font-medium text-white no-underline"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          {recentlyRead.isError && (
            <div className="py-16 text-center">
              <p className="mb-4 font-ui text-sm text-ns-ink-secondary">
                Couldn’t load your shelf. Check your connection and try again.
              </p>
              <button
                onClick={() => void recentlyRead.refetch()}
                className="rounded-ns border border-ns-border px-4 py-2 font-ui text-sm text-ns-ink"
              >
                Try again
              </button>
            </div>
          )}
          <ContinueReadingList
            items={recentlyRead.data ?? []}
            loading={recentlyRead.isPending}
            error={recentlyRead.isError}
            onOpen={(storyId) => navigate(`/story/${storyId}`)}
            onClear={() => clearHistory.mutate()}
            onExplore={() => navigate("/stories")}
          />
        </>
      )}
    </div>
  );
};

export default Shelf;
