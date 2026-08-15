import {
  CollectionReference,
  DocumentReference,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import {
  entryDoc,
  entryVotesCollection,
  replyDoc,
  replyVotesCollection,
} from "./guestbookPaths";

type VoteType = "up" | "down";

class GuestbookVoteService {
  /**
   * One vote transition for any votable document. Entries and replies differ
   * only in where their vote subcollection lives, so both go through here —
   * the counter deltas are the part worth having in exactly one place.
   */
  private async applyVote(
    target: DocumentReference,
    votes: CollectionReference,
    userId: string,
    voteType: VoteType | null,
  ): Promise<void> {
    const voteRef = doc(votes, userId);
    const batch = writeBatch(firestore);

    const currentVoteDoc = await getDoc(voteRef);
    const currentVote = currentVoteDoc.exists()
      ? (currentVoteDoc.data().voteType as VoteType)
      : null;

    if (voteType === null) {
      if (!currentVoteDoc.exists()) return;
      batch.delete(voteRef);
      batch.update(target, {
        [currentVote === "up" ? "upvoteCount" : "downvoteCount"]: increment(-1),
      });
    } else if (currentVote === null) {
      batch.set(voteRef, { userId, voteType, timestamp: serverTimestamp() });
      batch.update(target, {
        [voteType === "up" ? "upvoteCount" : "downvoteCount"]: increment(1),
      });
    } else if (currentVote === voteType) {
      // Clicking the active button clears the vote.
      batch.delete(voteRef);
      batch.update(target, {
        [voteType === "up" ? "upvoteCount" : "downvoteCount"]: increment(-1),
      });
    } else {
      batch.update(voteRef, { voteType, timestamp: serverTimestamp() });
      batch.update(target, {
        upvoteCount: increment(voteType === "up" ? 1 : -1),
        downvoteCount: increment(voteType === "down" ? 1 : -1),
      });
    }

    await batch.commit();
  }

  private async readVote(
    votes: CollectionReference,
    userId: string,
  ): Promise<VoteType | null> {
    try {
      const voteDoc = await getDoc(doc(votes, userId));
      return voteDoc.exists() ? (voteDoc.data().voteType as VoteType) : null;
    } catch (error) {
      console.error("Error getting guestbook vote:", error);
      return null;
    }
  }

  async voteEntry(
    ownerId: string,
    entryId: string,
    userId: string,
    voteType: VoteType | null,
  ): Promise<void> {
    try {
      await this.applyVote(
        entryDoc(ownerId, entryId),
        entryVotesCollection(ownerId, entryId),
        userId,
        voteType,
      );
    } catch (error) {
      console.error("Error voting on guestbook entry:", error);
      throw error;
    }
  }

  async voteReply(
    ownerId: string,
    entryId: string,
    replyId: string,
    userId: string,
    voteType: VoteType | null,
  ): Promise<void> {
    try {
      await this.applyVote(
        replyDoc(ownerId, entryId, replyId),
        replyVotesCollection(ownerId, entryId, replyId),
        userId,
        voteType,
      );
    } catch (error) {
      console.error("Error voting on guestbook reply:", error);
      throw error;
    }
  }

  /**
   * Vote docs live under different parents, and the web SDK has no cross-parent
   * batch get, so parallel single reads are the only option here.
   */
  async getUserVotesForEntries(
    ownerId: string,
    entryIds: string[],
    userId: string,
  ): Promise<Map<string, VoteType>> {
    const votesMap = new Map<string, VoteType>();
    if (!userId || entryIds.length === 0) return votesMap;

    try {
      await Promise.all(
        entryIds.map(async (entryId) => {
          const vote = await this.readVote(
            entryVotesCollection(ownerId, entryId),
            userId,
          );
          if (vote) votesMap.set(entryId, vote);
        }),
      );
    } catch (error) {
      console.error("Error getting guestbook entry votes:", error);
    }

    return votesMap;
  }

  async getUserVotesForReplies(
    ownerId: string,
    entryId: string,
    replyIds: string[],
    userId: string,
  ): Promise<Map<string, VoteType>> {
    const votesMap = new Map<string, VoteType>();
    if (!userId || replyIds.length === 0) return votesMap;

    try {
      await Promise.all(
        replyIds.map(async (replyId) => {
          const vote = await this.readVote(
            replyVotesCollection(ownerId, entryId, replyId),
            userId,
          );
          if (vote) votesMap.set(replyId, vote);
        }),
      );
    } catch (error) {
      console.error("Error getting guestbook reply votes:", error);
    }

    return votesMap;
  }
}

export const guestbookVoteService = new GuestbookVoteService();
