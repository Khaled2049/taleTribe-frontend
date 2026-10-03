import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  guestbookRepo,
  type IGuestbookEntry,
} from "@novelsync/story-data-client";

export type EntryPages = {
  pages: {
    entries: IGuestbookEntry[];
    nextCursor?: string;
    totalCount?: number;
  }[];
  pageParams: (string | undefined)[];
};

// The same post can be mounted in more than one view. Share pending votes so
// two controls cannot send competing toggles before the first write settles.
const votes = new WeakMap<QueryClient, Map<string, Promise<void>>>();

export function guestbookMutations(
  client: QueryClient,
  viewerId: string | null,
  isCurrentViewer: () => boolean,
) {
  const filters = (ownerId: string) => ({
    predicate: ({ queryKey: k }: { queryKey: QueryKey }) =>
      k[0] === "guestbook" &&
      ((k.length === 3 && k[1] === ownerId && k[2] === viewerId) ||
        (k.length === 4 && k[1] === "wall" && k[3] === viewerId)),
  });

  async function cancel(ownerId: string) {
    if (isCurrentViewer()) await client.cancelQueries(filters(ownerId));
  }

  function update(
    ownerId: string,
    transform: (data: EntryPages, key: QueryKey) => EntryPages,
  ) {
    if (!isCurrentViewer()) return;
    for (const [key, data] of client.getQueriesData<EntryPages>(
      filters(ownerId),
    )) {
      // Never manufacture a complete first page from one optimistic entry.
      if (data?.pages.length) client.setQueryData(key, transform(data, key));
    }
  }

  function refresh(ownerId: string, refetchActive = false) {
    if (!isCurrentViewer()) return;
    // Known copies are already patched. Mark lists stale for the next visit
    // without re-downloading all loaded pages after every click. Reply writes
    // request reconciliation because a cascade's count may not be known yet.
    void client.invalidateQueries({
      ...filters(ownerId),
      refetchType: refetchActive ? "active" : "none",
    });
    if (!refetchActive) {
      // An initial load may have been cancelled without data to patch.
      void client.refetchQueries({
        type: "active",
        predicate: (query) =>
          filters(ownerId).predicate(query) && query.state.data === undefined,
      });
    }
  }

  function patch(
    ownerId: string,
    entryId: string,
    fields: Partial<IGuestbookEntry>,
  ) {
    update(ownerId, (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        entries: page.entries.map((entry) =>
          entry.id === entryId ? { ...entry, ...fields } : entry,
        ),
      })),
    }));
  }

  function remove(ownerId: string, entryId: string, deleted = false) {
    update(ownerId, (data, key) => {
      const found = data.pages.some((page) =>
        page.entries.some((entry) => entry.id === entryId),
      );
      // A server-confirmed deletion also changes a wall's total when the
      // deleted entry was on a page that this cache hasn't loaded yet.
      if (!found && !(deleted && key.length === 3)) return data;
      return {
        ...data,
        pages: data.pages.map((page, index) => ({
          ...page,
          entries: page.entries.filter((entry) => entry.id !== entryId),
          ...(index === 0 && page.totalCount !== undefined
            ? { totalCount: Math.max(0, page.totalCount - 1) }
            : {}),
        })),
      };
    });
  }

  function add(entry: IGuestbookEntry) {
    update(entry.ownerId, (data, key) => {
      // These creates are always authored by the viewer. "Mine" means the
      // viewer's wall, whereas "All" includes their authorship elsewhere.
      if (
        key[1] === "wall" &&
        key.length === 4 &&
        (key[2] === "following" ||
          (key[2] === "mine" && entry.ownerId !== viewerId))
      )
        return data;
      if (
        data.pages.some((page) =>
          page.entries.some((row) => row.id === entry.id),
        )
      )
        return data;
      return {
        ...data,
        pages: data.pages.map((page, index) =>
          index !== 0
            ? page
            : {
                ...page,
                entries: [entry, ...page.entries].sort(
                  (a, b) =>
                    (b.createdAt?.getTime() ?? 0) -
                      (a.createdAt?.getTime() ?? 0) || b.id.localeCompare(a.id),
                ),
                ...(page.totalCount !== undefined
                  ? { totalCount: page.totalCount + 1 }
                  : {}),
              },
        ),
      };
    });
  }

  return {
    async createEntry(optimistic: IGuestbookEntry) {
      await cancel(optimistic.ownerId);
      if (!isCurrentViewer()) return;
      add(optimistic);
      try {
        const created = await guestbookRepo.createEntry(
          optimistic.ownerId,
          optimistic.content,
        );
        await cancel(optimistic.ownerId);
        remove(optimistic.ownerId, optimistic.id);
        add({ ...created, ownerUsername: optimistic.ownerUsername });
        return created;
      } catch (error) {
        await cancel(optimistic.ownerId);
        // Remove only this mutation's placeholder, preserving other writes.
        remove(optimistic.ownerId, optimistic.id);
        throw error;
      } finally {
        refresh(optimistic.ownerId);
      }
    },

    async deleteEntry(entry: IGuestbookEntry) {
      if (!isCurrentViewer()) return;
      await guestbookRepo.deleteEntry(entry.ownerId, entry.id);
      await cancel(entry.ownerId);
      remove(entry.ownerId, entry.id, true);
      refresh(entry.ownerId);
    },

    voteEntry(entry: IGuestbookEntry) {
      const pending = votes.get(client) ?? new Map<string, Promise<void>>();
      votes.set(client, pending);
      const key = JSON.stringify([viewerId, entry.ownerId, entry.id]);
      const existing = pending.get(key);
      if (existing) return existing;
      const operation = (async () => {
        await cancel(entry.ownerId);
        if (!isCurrentViewer()) return;
        // Roll back just vote fields in each copy, never a whole feed snapshot
        // which could erase a concurrent post or reply-count update.
        const snapshots = client
          .getQueriesData<EntryPages>(filters(entry.ownerId))
          .flatMap(([queryKey, data]) => {
            const row = data?.pages
              .flatMap((p) => p.entries)
              .find((e) => e.id === entry.id);
            return row ? [{ queryKey, row }] : [];
          });
        const previous = snapshots[0]?.row ?? entry;
        const vote: "up" | null = previous.userVote === "up" ? null : "up";
        const fields = {
          userVote: vote,
          upvoteCount: Math.max(0, previous.upvoteCount + (vote ? 1 : -1)),
          downvoteCount: Math.max(
            0,
            previous.downvoteCount - (previous.userVote === "down" ? 1 : 0),
          ),
        };
        patch(entry.ownerId, entry.id, fields);
        try {
          await guestbookRepo.voteEntry(entry.ownerId, entry.id, vote);
          await cancel(entry.ownerId);
          patch(entry.ownerId, entry.id, fields);
        } catch (error) {
          await cancel(entry.ownerId);
          if (isCurrentViewer()) {
            for (const { queryKey, row } of snapshots) {
              client.setQueryData<EntryPages>(
                queryKey,
                (data) =>
                  data && {
                    ...data,
                    pages: data.pages.map((page) => ({
                      ...page,
                      entries: page.entries.map((e) =>
                        e.id === entry.id
                          ? {
                              ...e,
                              userVote: row.userVote,
                              upvoteCount: row.upvoteCount,
                              downvoteCount: row.downvoteCount,
                            }
                          : e,
                      ),
                    })),
                  },
              );
            }
          }
          throw error;
        } finally {
          refresh(entry.ownerId);
        }
      })().finally(() => pending.delete(key));
      pending.set(key, operation);
      return operation;
    },

    replyCount(ownerId: string, entryId: string, count: number) {
      patch(ownerId, entryId, { commentCount: count });
      refresh(ownerId);
    },

    // Reply writes still use the existing full-thread read. Invalidate entry
    // counts even if that read fails or the thread unmounts before it finishes.
    async repliesChanged(ownerId: string) {
      await cancel(ownerId);
      refresh(ownerId, true);
    },
  };
}
