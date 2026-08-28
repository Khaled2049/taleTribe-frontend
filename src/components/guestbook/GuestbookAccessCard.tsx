import React from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import {
  GUESTBOOK_POLICIES,
  GUESTBOOK_POLICY_LABELS,
} from "@/lib/guestbookPolicy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGuestbookAccess } from "./useGuestbookAccess";

interface GuestbookAccessCardProps {
  userId: string;
  current: unknown;
  isLoading?: boolean;
}

/** An inline control for the owner's current guestbook posting policy. */
const GuestbookAccessCard: React.FC<GuestbookAccessCardProps> = ({
  userId,
  current,
  isLoading = false,
}) => {
  const { policy, saving, error, choose } = useGuestbookAccess(userId, current);
  const { label, description } = GUESTBOOK_POLICY_LABELS[policy];

  return (
    <section
      aria-labelledby="guestbook-access-heading"
      aria-busy={isLoading || saving}
      className="overflow-hidden rounded-ns-lg border border-ns-border bg-ns-surface"
    >
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ns-border bg-ns-elevated text-ns-accent">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2
            id="guestbook-access-heading"
            className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ns-ink-muted"
          >
            Guestbook access
          </h2>
          {saving && (
            <span className="ml-auto inline-flex items-center gap-1.5 font-ui text-[11.5px] text-ns-ink-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Saving
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="mt-4 animate-pulse" role="status">
            <span className="sr-only">Loading guestbook access</span>
            <div className="h-6 w-28 rounded bg-ns-border" />
            <div className="mt-2 h-3 w-full rounded bg-ns-border" />
            <div className="mt-1.5 h-3 w-4/5 rounded bg-ns-border" />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center lg:grid-cols-1">
            <div>
              <p className="font-heading text-[17px] sm:text-[20px] leading-tight text-ns-ink">
                Who can leave a note?
              </p>
              <p className="mt-1 font-body text-[12.5px] leading-relaxed text-ns-ink-secondary">
                {description}
              </p>
            </div>

            <Select value={policy} onValueChange={choose} disabled={saving}>
              <SelectTrigger
                aria-label="Who can leave a note"
                className="h-11 bg-ns-elevated font-ui text-[13px] font-semibold sm:h-10 lg:h-11"
              >
                <SelectValue>{label}</SelectValue>
              </SelectTrigger>
              <SelectContent position="popper">
                {GUESTBOOK_POLICIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {GUESTBOOK_POLICY_LABELS[option].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div aria-live="polite">
          {error && (
            <p className="mt-3 font-ui text-xs text-ns-destructive">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default GuestbookAccessCard;
