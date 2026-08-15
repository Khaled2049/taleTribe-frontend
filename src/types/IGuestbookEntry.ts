import { FirestoreDate } from "@/lib/relativeTime";

export interface IGuestbookEntry {
  id: string;
  /** Whose guestbook this entry sits in. Also the parent path segment. */
  ownerId: string;
  content: string;
  createdAt: FirestoreDate;
  authorUsername: string;
  authorId: string;
  commentCount: number;
  upvoteCount: number;
  downvoteCount: number;
  userVote?: "up" | "down" | null; // Client-side only, not stored in Firestore
}
