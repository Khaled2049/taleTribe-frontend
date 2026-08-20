import type { GuestbookDate } from "./IGuestbookEntry";

export interface IGuestbookReply {
  id: string;
  entryId: string;
  content: string;
  authorId: string;
  authorUsername: string;
  /** Set when this is a reply to another reply; null at the top level. */
  parentId: string | null;
  createdAt: GuestbookDate;
  updatedAt: GuestbookDate;
  upvoteCount: number;
  downvoteCount: number;
  userVote?: "up" | "down" | null; // Client-side only, not stored in Firestore
}
