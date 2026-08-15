import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useFollowingProfiles } from "@/hooks/queries/usePeopleQueries";

interface FollowingProps {
  /** The viewer's own `following` array. */
  following: readonly string[];
  /** Highlighted when you are already reading that person's wall. */
  activeUserId?: string;
}

/**
 * Solid bg-ns-accent, never an opacity modifier: the ns-* colours are plain
 * hex values behind a CSS variable, so `bg-ns-accent/70` compiles to a colour
 * the browser discards and the avatar renders invisible. Active state is
 * carried by the row around it, not by the badge.
 */
const Avatar: React.FC<{ username: string; size: string }> = ({
  username,
  size,
}) => (
  <span
    className={`
      shrink-0 ${size} rounded-full flex items-center justify-center
      bg-ns-accent font-ui text-xs font-semibold text-white
    `}
    aria-hidden="true"
  >
    {(username || "?").charAt(0).toUpperCase()}
  </span>
);

const SectionLabel: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`font-ui text-[11px] tracking-[1.5px] uppercase text-ns-ink-muted ${className}`}
  >
    Following
  </span>
);

/**
 * The people you follow, linking to their guestbooks. Always your own list, not
 * the list of whoever's wall you happen to be reading — it is a way to move
 * between walls, not a fact about the page.
 *
 * Two presentations, one query: both call useFollowingProfiles with the same
 * key, so React Query dedupes them to a single fetch even though only one is
 * ever visible at a given breakpoint.
 */
const FollowingSidebar: React.FC<FollowingProps> = ({
  following,
  activeUserId,
}) => {
  const { data, isLoading, isError } = useFollowingProfiles(following);
  const people = data ?? [];

  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-20">
        <div className="flex items-center h-9 mb-2 px-3 border-b border-ns-border">
          <SectionLabel />
        </div>

        {following.length === 0 ? (
          <p className="px-3 py-2 font-body text-[13px] text-ns-ink-muted leading-relaxed">
            You aren't following anyone yet.{" "}
            <Link
              to="/guestbook/people"
              className="text-ns-accent no-underline hover:underline"
            >
              Find people
            </Link>
            .
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-ns-ink-muted" />
          </div>
        ) : isError ? (
          <p className="px-3 py-2 font-ui text-xs text-ns-destructive">
            Could not load your list.
          </p>
        ) : (
          <nav aria-label="People you follow" className="flex flex-col gap-0.5">
            {people.map((person) => {
              const active = person.uid === activeUserId;
              return (
                <Link
                  key={person.uid}
                  to={`/guestbook/${person.uid}`}
                  aria-current={active ? "page" : undefined}
                  className={`
                    group flex items-center gap-2.5 px-3 py-2 rounded-ns
                    font-ui text-sm no-underline transition-colors duration-150
                    ${
                      active
                        ? "bg-ns-surface text-ns-ink font-medium"
                        : "text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink"
                    }
                  `}
                >
                  <Avatar username={person.username} size="w-7 h-7" />
                  <span className="truncate">@{person.username}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
};

/**
 * Mobile form of the same list: a horizontally scrolling strip of avatars, the
 * shape a narrow screen can actually carry. Renders nothing when you follow
 * nobody — the People tab is one tap away, and an empty rail above every wall
 * would be pure noise.
 */
export const FollowingStrip: React.FC<FollowingProps> = ({
  following,
  activeUserId,
}) => {
  const { data, isLoading } = useFollowingProfiles(following);
  const people = data ?? [];

  // Nothing to show, or nothing resolvable (an error, or everyone you follow
  // predates public profiles). A label above an empty rail is worse than
  // no rail — unlike the sidebar, this has no room for an explanation.
  if (following.length === 0) return null;
  if (!isLoading && people.length === 0) return null;

  return (
    <div className="lg:hidden mb-6">
      <SectionLabel className="block mb-2" />

      {isLoading ? (
        <div className="flex py-3">
          <Loader2 className="w-4 h-4 animate-spin text-ns-ink-muted" />
        </div>
      ) : (
        // Full-bleed so the rail scrolls edge to edge instead of stopping at
        // the page gutter, which reads as the end of the list.
        <nav
          aria-label="People you follow"
          className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto"
        >
          <div className="flex gap-4 pb-1">
            {people.map((person) => {
              const active = person.uid === activeUserId;
              return (
                <Link
                  key={person.uid}
                  to={`/guestbook/${person.uid}`}
                  aria-current={active ? "page" : undefined}
                  className="group flex flex-col items-center gap-1.5 shrink-0 w-[60px] no-underline"
                >
                  <Avatar
                    username={person.username}
                    size="w-11 h-11 text-sm"
                  />
                  <span
                    className={`
                      w-full truncate text-center font-ui text-[11px] leading-tight
                      ${active ? "text-ns-ink font-medium" : "text-ns-ink-secondary"}
                    `}
                  >
                    @{person.username}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default FollowingSidebar;
