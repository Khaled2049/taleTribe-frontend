import type { IGuestbookReply } from "@novelsync/story-data-client";

// Five segments, so the feed predicates in guestbookMutations (three for a
// wall, four for the combined feed) never match a thread.
export const guestbookRepliesKey = (
  ownerId: string,
  entryId: string,
  viewerId: string | null,
) => ["guestbook", "replies", ownerId, entryId, viewerId] as const;

/** The server lists a thread newest first, across every nesting level. */
export function addReply(
  replies: IGuestbookReply[],
  reply: IGuestbookReply,
): IGuestbookReply[] {
  if (replies.some((row) => row.id === reply.id)) return replies;
  return [reply, ...replies];
}

export function replaceReply(
  replies: IGuestbookReply[],
  reply: IGuestbookReply,
): IGuestbookReply[] {
  return replies.map((row) => (row.id === reply.id ? reply : row));
}

/** `parent_id` is ON DELETE CASCADE, so a reply takes its descendants with it. */
export function removeReplySubtree(
  replies: IGuestbookReply[],
  replyId: string,
): IGuestbookReply[] {
  const removed = new Set([replyId]);
  // A child can precede its parent in the list, so sweep until nothing new
  // joins the set rather than relying on order.
  for (let grew = true; grew;) {
    grew = false;
    for (const row of replies) {
      if (row.parentId && removed.has(row.parentId) && !removed.has(row.id)) {
        removed.add(row.id);
        grew = true;
      }
    }
  }
  return replies.filter((row) => !removed.has(row.id));
}

export function toggleReplyUpvote(reply: IGuestbookReply): IGuestbookReply {
  const vote = reply.userVote === "up" ? null : "up";
  return {
    ...reply,
    userVote: vote,
    upvoteCount: Math.max(0, reply.upvoteCount + (vote ? 1 : -1)),
    downvoteCount: Math.max(
      0,
      reply.downvoteCount - (reply.userVote === "down" ? 1 : 0),
    ),
  };
}
