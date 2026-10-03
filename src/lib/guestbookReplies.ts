import {
  StoryDataError,
  type GuestbookReplyPage,
  type IGuestbookReply,
} from "@novelsync/story-data-client";

// Five segments, so the feed predicates in guestbookMutations (three for a
// wall, four for the combined feed) never match a thread.
export const guestbookRepliesKey = (
  ownerId: string,
  entryId: string,
  viewerId: string | null,
) => ["guestbook", "replies", ownerId, entryId, viewerId] as const;

/**
 * What the cache holds for a thread: the pages loaded so far, flattened. Pages
 * are whole subtrees, so every reply here has its ancestors here too.
 * `totalCount` covers the pages not loaded yet and is the post's reply count.
 */
export type ReplyThread = GuestbookReplyPage;

/** The server lists a thread newest first, across every nesting level. */
export function addReply(
  thread: ReplyThread,
  reply: IGuestbookReply,
): ReplyThread {
  if (thread.replies.some((row) => row.id === reply.id)) return thread;
  return {
    ...thread,
    replies: [reply, ...thread.replies],
    totalCount: thread.totalCount + 1,
  };
}

export function replaceReply(
  thread: ReplyThread,
  reply: IGuestbookReply,
): ReplyThread {
  return {
    ...thread,
    replies: thread.replies.map((row) => (row.id === reply.id ? reply : row)),
  };
}

/** `parent_id` is ON DELETE CASCADE, so a reply takes its descendants with it. */
export function removeReplySubtree(
  thread: ReplyThread,
  replyId: string,
): ReplyThread {
  const removed = new Set([replyId]);
  // A child can precede its parent in the list, so sweep until nothing new
  // joins the set rather than relying on order.
  for (let grew = true; grew;) {
    grew = false;
    for (const row of thread.replies) {
      if (row.parentId && removed.has(row.parentId) && !removed.has(row.id)) {
        removed.add(row.id);
        grew = true;
      }
    }
  }
  const replies = thread.replies.filter((row) => !removed.has(row.id));
  return {
    ...thread,
    replies,
    // Counted from what actually left, so an unknown id changes nothing.
    totalCount: Math.max(
      0,
      thread.totalCount - (thread.replies.length - replies.length),
    ),
  };
}

/** Older threads go after the loaded ones; the newer page's count wins. */
export function appendReplyPage(
  thread: ReplyThread,
  page: GuestbookReplyPage,
): ReplyThread {
  const loaded = new Set(thread.replies.map((row) => row.id));
  return {
    replies: [
      ...thread.replies,
      ...page.replies.filter((row) => !loaded.has(row.id)),
    ],
    nextCursor: page.nextCursor,
    totalCount: page.totalCount,
  };
}

/**
 * The combined feed mixes walls with different policies and does not know
 * them up front, so there the server's refusal is the first the viewer hears.
 */
export const isWallClosedError = (error: unknown): boolean =>
  error instanceof StoryDataError && error.status === 403;

export function replyErrorMessage(error: unknown, fallback: string): string {
  if (isWallClosedError(error)) {
    return "This guestbook isn't accepting replies from you.";
  }
  if (error instanceof StoryDataError && error.status === 429) {
    return "You've reached today's reply limit. Try again tomorrow.";
  }
  return fallback;
}

const NO_CHILDREN: readonly IGuestbookReply[] = [];

/**
 * One pass over the thread instead of a scan per rendered reply. A reply whose
 * parent is missing from the list is unreachable, exactly as it was when each
 * reply filtered the list for its own children.
 */
export function indexReplies(replies: readonly IGuestbookReply[]) {
  const roots: IGuestbookReply[] = [];
  const children = new Map<string, IGuestbookReply[]>();
  for (const reply of replies) {
    if (!reply.parentId) {
      roots.push(reply);
      continue;
    }
    const siblings = children.get(reply.parentId);
    if (siblings) siblings.push(reply);
    else children.set(reply.parentId, [reply]);
  }
  return {
    roots,
    childrenOf: (replyId: string) => children.get(replyId) ?? NO_CHILDREN,
  };
}

export type ReplyIndex = ReturnType<typeof indexReplies>;

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
