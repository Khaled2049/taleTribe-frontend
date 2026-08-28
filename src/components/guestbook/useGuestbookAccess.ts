import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { profileRepo } from "@novelsync/story-data-client";
import { GuestbookPolicy, normalizePolicy } from "@/lib/guestbookPolicy";
import { queryKeys } from "@/hooks/queries/queryKeys";

/**
 * Reading and writing the owner's guestbook posting policy.
 *
 * Shared by the two controls that expose it — the full card in the desktop
 * sidebar and the compact menu on mobile — so a change to what saving means
 * (the invalidation, the failure message) cannot land in one and not the other.
 */
export function useGuestbookAccess(userId: string, current: unknown) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const policy = normalizePolicy(current);

  const choose = async (nextPolicy: string) => {
    const next = nextPolicy as GuestbookPolicy;
    if (next === policy || saving) return;

    setSaving(true);
    setError(null);
    try {
      await profileRepo.updateMe({ guestbookPolicy: next });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.user.publicProfile(userId),
      });
    } catch (err) {
      console.error("Error saving guestbook policy:", err);
      setError("Could not save that setting. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return { policy, saving, error, choose };
}
