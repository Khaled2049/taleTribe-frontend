import {
  DocumentData,
  DocumentReference,
  QueryDocumentSnapshot,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
} from "firebase/firestore";
import { IGuestbookEntry } from "@/types/IGuestbookEntry";
import { rateLimitService } from "./RateLimitService";
import { RateLimitError } from "./rateLimitError";
import { commitInChunks } from "./firestoreCascade";
import {
  entryDoc,
  entryVotesCollection,
  guestbookCollection,
  repliesCollection,
  replyVotesCollection,
} from "./guestbookPaths";

const toEntry = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
  ownerId: string,
): IGuestbookEntry => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ownerId,
    content: data.content,
    authorId: data.authorId,
    authorUsername: data.authorUsername,
    createdAt: data.createdAt?.toDate() || new Date(),
    commentCount: data.commentCount || 0,
    upvoteCount: data.upvoteCount || 0,
    downvoteCount: data.downvoteCount || 0,
  };
};

class GuestbookService {
  async listEntries(
    ownerId: string,
    limitCount: number = 10,
    lastDoc?: QueryDocumentSnapshot<DocumentData>,
  ): Promise<{
    entries: IGuestbookEntry[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }> {
    try {
      const constraints = [orderBy("createdAt", "desc")];
      const entriesQuery = lastDoc
        ? query(
            guestbookCollection(ownerId),
            ...constraints,
            startAfter(lastDoc),
            limit(limitCount),
          )
        : query(guestbookCollection(ownerId), ...constraints, limit(limitCount));

      const snapshot = await getDocs(entriesQuery);
      return {
        entries: snapshot.docs.map((d) => toEntry(d, ownerId)),
        lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
      };
    } catch (error) {
      console.error("Error listing guestbook entries:", error);
      throw error;
    }
  }

  async addEntry(
    ownerId: string,
    entry: Pick<
      IGuestbookEntry,
      "content" | "authorId" | "authorUsername"
    >,
  ): Promise<string> {
    try {
      const rateLimitCheck = await rateLimitService.canCreatePost(
        entry.authorId,
      );
      if (!rateLimitCheck.allowed) {
        throw new RateLimitError(
          rateLimitCheck.message || "Rate limit exceeded",
          rateLimitCheck.count,
          rateLimitCheck.limit,
        );
      }

      const newEntryRef = doc(guestbookCollection(ownerId));
      await setDoc(newEntryRef, {
        id: newEntryRef.id,
        ownerId,
        content: entry.content,
        authorId: entry.authorId,
        authorUsername: entry.authorUsername,
        createdAt: serverTimestamp(),
        commentCount: 0,
        upvoteCount: 0,
        downvoteCount: 0,
      });

      await rateLimitService.incrementPostCount(entry.authorId);

      return newEntryRef.id;
    } catch (error) {
      console.error("Error adding guestbook entry:", error);
      throw error;
    }
  }

  async deleteEntry(ownerId: string, entryId: string): Promise<void> {
    try {
      const refs: DocumentReference[] = [];

      const replies = await getDocs(repliesCollection(ownerId, entryId));
      for (const reply of replies.docs) {
        const replyVotes = await getDocs(
          replyVotesCollection(ownerId, entryId, reply.id),
        );
        replyVotes.forEach((v) => refs.push(v.ref));
        refs.push(reply.ref);
      }

      const entryVotes = await getDocs(entryVotesCollection(ownerId, entryId));
      entryVotes.forEach((v) => refs.push(v.ref));

      refs.push(entryDoc(ownerId, entryId));

      await commitInChunks(refs);
    } catch (error) {
      console.error("Error deleting guestbook entry:", error);
      throw error;
    }
  }

}

export const guestbookService = new GuestbookService();
