import React from "react";
import { Loader2, Settings } from "lucide-react";
import {
  GUESTBOOK_POLICIES,
  GUESTBOOK_POLICY_LABELS,
} from "@/lib/guestbookPolicy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGuestbookAccess } from "./useGuestbookAccess";

interface GuestbookAccessMenuProps {
  userId: string;
  current: unknown;
  isLoading?: boolean;
  className?: string;
}

/**
 * The compact form of GuestbookAccessCard, for the toolbar row above the feed.
 *
 * Same single setting, same hook — this drops the card's heading, description
 * and skeleton, none of which earn their vertical space on a phone above an
 * unbounded feed. The current policy still reads off the menu itself, as the
 * checked radio item.
 */
const GuestbookAccessMenu: React.FC<GuestbookAccessMenuProps> = ({
  userId,
  current,
  isLoading = false,
  className = "",
}) => {
  const { policy, saving, error, choose } = useGuestbookAccess(userId, current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          aria-label="Guestbook access"
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ns-border bg-ns-surface text-ns-ink-secondary transition-colors hover:border-ns-border-strong hover:text-ns-ink disabled:opacity-50 ${className}`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Settings className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ns-ink-muted">
          Who can leave a note?
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={policy} onValueChange={choose}>
          {GUESTBOOK_POLICIES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              disabled={saving}
              className="font-ui text-[13px]"
            >
              {GUESTBOOK_POLICY_LABELS[option].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {/* The trigger is an icon, so a failed save has nowhere else to show. */}
        {error && (
          <>
            <DropdownMenuSeparator />
            <p
              role="alert"
              className="px-2 py-1.5 font-ui text-xs text-ns-destructive"
            >
              {error}
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GuestbookAccessMenu;
