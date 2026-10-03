import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { guestbookMutations } from "@/lib/guestbookMutations";

export function useGuestbookMutations(viewerId: string | null) {
  const client = useQueryClient();
  return useMemo(
    () =>
      guestbookMutations(
        client,
        viewerId,
        () => (useAuthStore.getState().user?.uid ?? null) === viewerId,
      ),
    [client, viewerId],
  );
}
