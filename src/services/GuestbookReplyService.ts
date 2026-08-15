import {
  DocumentData,
  DocumentReference,
  QueryDocumentSnapshot,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { IGuestbookReply } from "@/types/IGuestbookReply";
import { guestbookVoteService } from "./GuestbookVoteService";
import { rateLimitService } from "./RateLimitService";
import { RateLimitError } from "./rateLimitError";
import { commitInChunks } from "./firestoreCascade";
import {
  entryDoc,
  repliesCollection,
  replyDoc,
  replyVotesCollection,
} from "./guestbookPaths";

const toReply = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
  entryId: string,
): IGuestbookReply => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    entryId,
    content: data.content,
    authorId: data.authorId,
    authorUsername: data.authorUsername,
    parentId: data.parentId ?? null,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    upvoteCount: data.upvoteCount || 0,
    downvoteCount: data.downvoteCount || 0,
  };
};

class GuestbookReplyService {
  async getReplies(
    ownerId: string,
    entryId: string,
  ): Promise<IGuestbookReply[]> {
    try {
      const snapshot = await getDocs(
        query(
          repliesCollection(ownerId, entryId),
          orderBy("createdAt", "desc"),
        ),
      );
      return snapshot.docs.map((d) => toReply(d, entryId));
    } catch (error) {
      console.error("Error getting guestbook replies:", error);
      throw error;
    }
  }

  async addReply(
    ownerId: string,
    entryId: string,
    reply: Pick<
      IGuestbookReply,
      "content" | "authorId" | "authorUsername" | "parentId"
    >,
  ): Promise<string> {
    try {
      const rateLimitCheck = await rateLimitService.canCreateComment(
        reply.authorId,
      );
      if (!rateLimitCheck.allowed) {
        throw new RateLimitError(
          rateLimitCheck.message || "Rate limit exceeded",
          rateLimitCheck.count,
          rateLimitCheck.limit,
        );
      }

      const newReplyRef = doc(repliesCollection(ownerId, entryId));
      await setDoc(newReplyRef, {
        ...reply,
        id: newReplyRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        upvoteCount: 0,
        downvoteCount: 0,
      });

      // increment(), not read-then-write: two people replying at once would
      // otherwise both read the same count and write the same value.
      await updateDoc(entryDoc(ownerId, entryId), {
        commentCount: increment(1),
      });

      await rateLimitService.incrementCommentCount(reply.authorId);

      return newReplyRef.id;
    } catch (error) {
      console.error("Error adding guestbook reply:", error);
      throw error;
    }
  }

  async updateReply(
    ownerId: string,
    entryId: string,
    replyId: string,
    content: string,
  ): Promise<void> {
    try {
      await updateDoc(replyDoc(ownerId, entryId, replyId), {
        content,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating guestbook reply:", error);
      throw error;
    }
  }

  /**
   * Deletes the reply and everything hanging off it. Replies are stored flat
   * with a `parentId`, so the subtree is walked in memory from a single read —
   * deleting only direct children would orphan grandchildren, which the UI
   * nests up to three deep.
   */
  async deleteReply(
    ownerId: string,
    entryId: string,
    replyId: string,
  ): Promise<void> {
    try {
      const all = await getDocs(repliesCollection(ownerId, entryId));

      const childrenByParent = new Map<string, string[]>();
      all.docs.forEach((d) => {
        const parentId = d.data().parentId ?? null;
        if (!parentId) return;
        childrenByParent.set(parentId, [
          ...(childrenByParent.get(parentId) ?? []),
          d.id,
        ]);
      });

      const doomed: string[] = [];
      const walk = (id: string) => {
        doomed.push(id);
        (childrenByParent.get(id) ?? []).forEach(walk);
      };
      walk(replyId);

      const refs: DocumentReference[] = [];
      for (const id of doomed) {
        const votes = await getDocs(replyVotesCollection(ownerId, entryId, id));
        votes.forEach((v) => refs.push(v.ref));
        refs.push(replyDoc(ownerId, entryId, id));
      }

      await commitInChunks(refs);

      await updateDoc(entryDoc(ownerId, entryId), {
        commentCount: increment(-doomed.length),
      });
    } catch (error) {
      console.error("Error deleting guestbook reply:", error);
      throw error;
    }
  }

  async hydrateUserVotes(
    ownerId: string,
    entryId: string,
    replies: IGuestbookReply[],
    userId: string,
  ): Promise<IGuestbookReply[]> {
    if (!userId || replies.length === 0) return replies;

    const userVotes = await guestbookVoteService.getUserVotesForReplies(
      ownerId,
      entryId,
      replies.map((r) => r.id),
      userId,
    );
    return replies.map((reply) => ({
      ...reply,
      userVote: userVotes.get(reply.id) ?? null,
    }));
  }
}

export const guestbookReplyService = new GuestbookReplyService();
