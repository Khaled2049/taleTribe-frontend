/**
 * The repo maps every date through `new Date(...)`, so a Firestore `Timestamp`
 * can never reach a consumer. Narrowing to `Date` here is what keeps this
 * package free of a firebase import; `null | undefined` stays for the
 * optimistic rows the UI builds before the server answers.
 */
export type GuestbookDate = Date | null | undefined;

export interface IGuestbookEntry {
  id: string;
  /** Whose guestbook this entry sits in. Also the parent path segment. */
  ownerId: string;
  content: string;
  createdAt: GuestbookDate;
  authorUsername: string;
  authorId: string;
  commentCount: number;
  upvoteCount: number;
  downvoteCount: number;
  userVote?: "up" | "down" | null; // Client-side only, not stored in Firestore
}
