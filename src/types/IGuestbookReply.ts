import { FirestoreDate } from "@/lib/relativeTime";

export interface IGuestbookReply {
  id: string;
  entryId: string;
  content: string;
  authorId: string;
  authorUsername: string;
  /** Set when this is a reply to another reply; null at the top level. */
  parentId: string | null;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  upvoteCount: number;
  downvoteCount: number;
  userVote?: "up" | "down" | null; // Client-side only, not stored in Firestore
}
