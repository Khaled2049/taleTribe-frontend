import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2, Users, X } from "lucide-react";
import { useFollowingProfiles } from "@/hooks/queries/usePeopleQueries";

const PEOPLE_PATH = "/guestbook/people";

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
 * Two presentations, one query: this and FollowingDrawer both call
 * useFollowingProfiles with the same key, so React Query dedupes them to a
 * single fetch even though only one is ever visible at a given breakpoint.
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
        <div className="flex items-baseline justify-between h-9 mb-2 px-3 border-b border-ns-border">
          <SectionLabel />
          <Link
            to="/guestbook/people"
            className="font-ui text-xs font-semibold text-ns-accent no-underline hover:underline"
          >
            Manage
          </Link>
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

        {following.length > 0 && (
          <div className="mt-[26px] border border-ns-border rounded-ns-lg bg-ns-surface px-[15px] py-3.5">
            <div className="font-heading text-[17px] text-ns-ink mb-1">
              Quiet week?
            </div>
            <p className="font-body text-[13px] leading-relaxed text-ns-ink-secondary">
              Your wall only shows people you follow. Find more writers in{" "}
              <Link
                to="/guestbook/people"
                className="text-ns-accent no-underline hover:underline"
              >
                People
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

/**
 * Mobile form of the same list: a panel that slides in from the left, opened
 * from a trigger that sits where the page's own content starts.
 *
 * A drawer rather than the always-visible rail it replaces, because the rail
 * spent real vertical space above the composer on every visit to say something
 * you only need when you are actually navigating between walls. Trigger and
 * panel ship together so a page adopts the whole behaviour in one element and
 * cannot end up rendering one without the other.
 */
export const FollowingDrawer: React.FC<FollowingProps> = ({
  following,
  activeUserId,
}) => {
  const { data, isLoading } = useFollowingProfiles(following);
  const people = data ?? [];
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The People tab renders this too, where the footer link would point at the
  // page you are already reading.
  const onPeoplePage = useLocation().pathname === PEOPLE_PATH;

  const close = () => setIsOpen(false);

  // Escape closes, and focus goes back to the trigger it came from — without
  // this a keyboard user is returned to the top of the document instead.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // The page behind a drawer must not scroll under it.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Nothing to show, or nothing resolvable (an error, or everyone you follow
  // predates public profiles). An empty drawer is worse than no drawer — the
  // People tab is one tap away either way.
  if (following.length === 0) return null;
  if (!isLoading && people.length === 0) return null;

  // Spacing is deliberately not owned here: the trigger sits in a toolbar row
  // alongside controls this component knows nothing about, so the row places it.
  // Each element carries its own lg:hidden rather than relying on a wrapper,
  // since there is no longer a root box to hang one breakpoint rule on.
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="lg:hidden inline-flex items-center gap-2 rounded-full border border-ns-border bg-ns-surface px-3.5 py-2 font-ui text-[13px] font-semibold text-ns-ink-secondary transition-colors hover:border-ns-border-strong hover:text-ns-ink"
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
        Following
        {!isLoading && (
          <span className="font-ui text-[12px] font-medium text-ns-ink-muted">
            {people.length}
          </span>
        )}
      </button>

      {/* Scrim. Not `hidden` when closed — it fades, so it has to stay in the
          tree — but pointer-events must not linger over the page. */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="People you follow"
        aria-hidden={!isOpen}
        className={`lg:hidden fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-r border-ns-border bg-ns-bg transition-transform duration-300 ease-ns-spring ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ns-border px-4 py-3.5">
          <SectionLabel />
          <button
            type="button"
            onClick={close}
            aria-label="Close following list"
            className="-mr-2 rounded-ns p-2 text-ns-ink-secondary transition-colors hover:bg-ns-surface hover:text-ns-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-ns-ink-muted" />
            </div>
          ) : (
            <nav aria-label="People you follow" className="flex flex-col gap-0.5">
              {people.map((person) => {
                const active = person.uid === activeUserId;
                return (
                  <Link
                    key={person.uid}
                    to={`/guestbook/${person.uid}`}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`
                      flex items-center gap-3 rounded-ns px-3 py-2.5
                      font-ui text-sm no-underline transition-colors duration-150
                      ${
                        active
                          ? "bg-ns-surface font-medium text-ns-ink"
                          : "text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink"
                      }
                    `}
                  >
                    <Avatar username={person.username} size="w-8 h-8" />
                    <span className="truncate">@{person.username}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {!onPeoplePage && (
          <div className="shrink-0 border-t border-ns-border p-4">
            <Link
              to={PEOPLE_PATH}
              onClick={close}
              className="font-ui text-[13px] font-semibold text-ns-accent no-underline hover:underline"
            >
              Manage in People →
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default FollowingSidebar;
