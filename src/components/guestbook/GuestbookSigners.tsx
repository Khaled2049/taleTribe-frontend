import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useGuestbookEntries } from "@/hooks/queries/useGuestbookQueries";
import FollowButton from "@/components/common/FollowButton";
import { formatRelativeTime } from "@/lib/relativeTime";
import { toSigners } from "@/lib/guestbookSigners";

interface GuestbookSignersProps {
  /** Whose guestbook this is. */
  ownerId: string;
  /** The viewer, or null when signed out. Must match what Guestbook passes. */
  viewerId: string | null;
}

const MAX_SIGNERS = 5;

/**
 * Other people who have signed this guestbook — a real discovery path, since
 * they are demonstrably interested in the same writer.
 *
 * This replaces a hardcoded "Writers you may know" card. A genuine suggestion
 * engine is not possible client-side: the only follow graph a client may read
 * is its own, so "followed by @someone" would need a new endpoint.
 *
 * Costs nothing to render. It calls useGuestbookEntries with the same owner
 * and viewer the Guestbook itself uses, so React Query serves it from the same
 * cache entry rather than issuing a second request — which also means the list
 * grows as the reader pages through older entries. It is deliberately titled
 * as a subset ("also signed") rather than a complete roster.
 */
const GuestbookSigners: React.FC<GuestbookSignersProps> = ({
  ownerId,
  viewerId,
}) => {
  const { data } = useGuestbookEntries(ownerId, viewerId);

  const signers = useMemo(() => {
    const entries = data?.pages.flatMap((page) => page.entries) ?? [];
    // The owner is not a discovery: you are already on their page. The viewer
    // is filtered here too so a signed-in reader who has posted does not see
    // themselves suggested — FollowButton would render nothing for that row.
    const exclude = new Set([ownerId, ...(viewerId ? [viewerId] : [])]);
    return toSigners(entries, exclude).slice(0, MAX_SIGNERS);
  }, [data, ownerId, viewerId]);

  if (signers.length === 0) return null;

  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface p-4">
      <div className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-ns-ink-muted mb-2.5">
        Also signed this guestbook
      </div>
      <div className="flex flex-col gap-3">
        {signers.map((signer) => (
          <div key={signer.id} className="flex items-center gap-2.5">
            <Link
              to={`/guestbook/${signer.id}`}
              className="flex flex-1 min-w-0 items-center gap-2.5 no-underline"
            >
              <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full bg-ns-ink-muted text-white flex items-center justify-center font-ui font-bold text-xs">
                {(signer.username || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-ui text-[13.5px] font-semibold text-ns-ink truncate">
                  @{signer.username}
                </div>
                <div className="font-ui text-[11.5px] text-ns-ink-muted truncate">
                  {signer.posts > 1 && `${signer.posts} posts · `}
                  {formatRelativeTime(signer.latest)}
                </div>
              </div>
            </Link>
            <FollowButton targetId={signer.id} size="sm" className="shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuestbookSigners;
