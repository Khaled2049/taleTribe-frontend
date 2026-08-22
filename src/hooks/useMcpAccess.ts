import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { firestore } from "@novelsync/platform-auth";

export type McpAccessStatus = "none" | "requested" | "granted" | "revoked";

interface McpAccessState {
  status: McpAccessStatus;
  loading: boolean;
  requesting: boolean;
  error: string | null;
  request: (note?: string) => Promise<void>;
}

/**
 * Read-and-request hook for the MCP rollout allowlist (`mcpAccess/{uid}`).
 *
 * Subscribed rather than fetched so the card flips to "granted" the moment the
 * owner runs `npm run grant-mcp` — without that, an approved user would sit on
 * a stale "pending" screen with nothing telling them to reload.
 *
 * Only the request side is writable from here. firestore.rules pins `status`
 * to "requested" on create, and the sole update it permits is the
 * revoked → requested re-request, so this cannot grant itself access no
 * matter what it sends.
 */
export function useMcpAccess(uid: string | undefined): McpAccessState {
  const [status, setStatus] = useState<McpAccessStatus>("none");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setStatus("none");
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, "mcpAccess", uid),
      (snapshot) => {
        const next = snapshot.exists()
          ? (snapshot.data().status as McpAccessStatus)
          : "none";
        setStatus(next || "none");
        setLoading(false);
      },
      () => {
        // A rules denial or offline read shouldn't strand the card in a
        // spinner; treat it as "no request on file" and let them try.
        setStatus("none");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid]);

  const request = useCallback(
    async (note?: string) => {
      if (!uid) return;
      setRequesting(true);
      setError(null);
      try {
        await setDoc(doc(firestore, "mcpAccess", uid), {
          status: "requested",
          requestedAt: serverTimestamp(),
          ...(note?.trim() ? { note: note.trim().slice(0, 500) } : {}),
        });
      } catch {
        // Rules allow create, and the one update transition revoked →
        // requested. The likeliest refusal left is a request that is already
        // pending (update from "requested" is denied), or a granted record
        // (nothing to request).
        setError(
          "Could not send the request. If access is already pending or granted, there's nothing more to do.",
        );
      } finally {
        setRequesting(false);
      }
    },
    [uid],
  );

  return { status, loading, requesting, error, request };
}
