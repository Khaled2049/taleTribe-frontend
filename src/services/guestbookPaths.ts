import { collection, doc } from "firebase/firestore";
import { firestore } from "@/config/firebase";

/**
 * Guestbook entries live under their owner rather than in a top-level
 * collection, so `ownerId` is a path segment. That is what lets the rules grant
 * the guestbook owner delete rights over anyone's entry without a lookup, and
 * it keeps "newest entries for one owner" on the automatic single-field index.
 * Every path helper therefore needs the owner, not just the entry id.
 */

export const guestbookCollection = (ownerId: string) =>
  collection(firestore, "users", ownerId, "guestbook");

export const entryDoc = (ownerId: string, entryId: string) =>
  doc(guestbookCollection(ownerId), entryId);

export const entryVotesCollection = (ownerId: string, entryId: string) =>
  collection(entryDoc(ownerId, entryId), "votes");

export const repliesCollection = (ownerId: string, entryId: string) =>
  collection(entryDoc(ownerId, entryId), "replies");

export const replyDoc = (ownerId: string, entryId: string, replyId: string) =>
  doc(repliesCollection(ownerId, entryId), replyId);

export const replyVotesCollection = (
  ownerId: string,
  entryId: string,
  replyId: string,
) => collection(replyDoc(ownerId, entryId, replyId), "votes");
