import React, { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GUESTBOOK_POLICIES,
  GUESTBOOK_POLICY_LABELS,
  GuestbookPolicy,
  normalizePolicy,
} from "@/lib/guestbookPolicy";
import { profileRepo } from "@/services/ProfileRepo";
import { queryKeys } from "@/hooks/queries/queryKeys";

interface WallPolicySelectProps {
  userId: string;
  current: unknown;
}

/**
 * Owner-only control for who may sign this guestbook. Rendered on the wall it
 * governs rather than in profile settings, so the setting and its effect are
 * visible together.
 */
const WallPolicySelect: React.FC<WallPolicySelectProps> = ({
  userId,
  current,
}) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<GuestbookPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = normalizePolicy(current);

  const choose = async (policy: GuestbookPolicy) => {
    if (policy === selected || saving) return;

    setSaving(policy);
    setError(null);
    try {
      await profileRepo.updateMe({ guestbookPolicy: policy });
      // The gate reads this profile, so the wall must re-render against the new
      // value rather than wait out staleTime.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.user.guestbookPolicy(userId),
      });
    } catch (err) {
      console.error("Error saving guestbook policy:", err);
      setError("Could not save that setting. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-6 p-4 rounded-ns border border-ns-border bg-ns-surface">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-3.5 h-3.5 text-ns-ink-muted" />
        <h2 className="font-ui text-[13px] font-medium text-ns-ink">
          Who can sign your guestbook
        </h2>
      </div>
      <p className="font-body text-[13px] text-ns-ink-secondary mb-3">
        Changing this does not remove notes that are already here.
      </p>

      {error && (
        <p className="mb-2 font-ui text-xs text-ns-destructive">{error}</p>
      )}

      <div className="flex flex-col gap-1">
        {GUESTBOOK_POLICIES.map((policy) => {
          const { label, description } = GUESTBOOK_POLICY_LABELS[policy];
          const active = policy === selected;
          return (
            <button
              key={policy}
              type="button"
              onClick={() => choose(policy)}
              disabled={!!saving}
              aria-pressed={active}
              className={`
                flex items-start gap-2.5 text-left px-3 py-2 rounded-ns
                transition-colors duration-150 disabled:opacity-60
                ${active ? "bg-ns-elevated border border-ns-border-strong" : "border border-transparent hover:bg-ns-surface-hover"}
              `}
            >
              <span className="mt-0.5 w-3.5 shrink-0">
                {saving === policy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-ns-ink-muted" />
                ) : active ? (
                  <Check className="w-3.5 h-3.5 text-ns-accent" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block font-ui text-[13px] text-ns-ink">
                  {label}
                </span>
                <span className="block font-body text-xs text-ns-ink-muted">
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WallPolicySelect;
