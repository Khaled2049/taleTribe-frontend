import { createContext, useContext } from "react";
import { GuestbookPolicy } from "@/lib/guestbookPolicy";

interface GuestbookPolicyValue {
  /** Whether the current viewer may add an entry or a reply to this wall. */
  canPost: boolean;
  policy: GuestbookPolicy;
  /** Empty when posting is allowed. */
  closedReason: string;
}

/**
 * Context rather than props because GuestbookReply renders itself recursively up
 * to three levels deep — a prop would have to be threaded through every one of
 * them, and every intermediate component would gain a parameter it does not use.
 *
 * Defaults to open so a subtree rendered outside the provider behaves the way it
 * did before this setting existed. The rules are the real gate either way.
 */
export const GuestbookPolicyContext = createContext<GuestbookPolicyValue>({
  canPost: true,
  policy: "everyone",
  closedReason: "",
});

export const useGuestbookPolicy = (): GuestbookPolicyValue =>
  useContext(GuestbookPolicyContext);
