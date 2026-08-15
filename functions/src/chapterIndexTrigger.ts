/**
 * Chapter-write trigger — the single chokepoint that keeps chat context cheap.
 *
 * Fires on any write to stories/{storyId}/chapters/{chapterId} (client SDK edits,
 * imports — all paths). It does two things:
 *
 *  1. (Step 2) Rebuilds `chapterIndex` on the story doc — a tiny
 *     {title, order, chapterNumber}[] array. Chat reads this instead of streaming
 *     every chapter body, so the per-message Firestore cost stops growing with
 *     book length. The expensive all-chapters read happens here, on write (rare),
 *     not on chat (frequent).
 *
 *  2. (Step 3) Asks the agent to (re)embed the chapter body into the vector index
 *     (or delete it on chapter delete). Embedding cost is paid once per edit, not
 *     per chat message.
 *
 * Writing `chapterIndex` to the parent story doc does NOT re-fire this trigger
 * (it watches the chapters subcollection), so there's no recursion.
 *
 * See chat-scaling-design.md.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { callAgent } from "./agentService";
import { IndexChapterTaskPayload } from "./indexChapterTask";
import {
  VECTOR_INDEX_DISABLED,
  debounceBucket,
  enqueueDebounced,
  resolveOwnerId,
} from "./indexShared";

const db = admin.firestore();

interface ChapterIndexEntry {
  chapterNumber: number | null;
  order: number | null;
  title: string;
}

/** Rebuild the denormalized chapter index on the story doc (titles only). */
async function rebuildChapterIndex(storyId: string): Promise<void> {
  const snap = await db
    .collection("stories")
    .doc(storyId)
    .collection("chapters")
    .select("title", "order", "chapterNumber")
    .get();

  const chapterIndex: ChapterIndexEntry[] = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        chapterNumber: data.chapterNumber ?? null,
        order: data.order ?? null,
        title: data.title ?? "Untitled",
      };
    })
    .sort((a, b) => {
      const aKey = a.order ?? a.chapterNumber ?? 0;
      const bKey = b.order ?? b.chapterNumber ?? 0;
      return aKey - bKey;
    });

  await db
    .collection("stories")
    .doc(storyId)
    .set({ chapterIndex }, { merge: true });
}

/** Enqueue a debounced chapter re-index (dedup id bucketed by time window). */
async function enqueueDebouncedIndex(
  storyId: string,
  chapterId: string,
): Promise<void> {
  const id = `idx_chapter_${storyId}_${chapterId}_${debounceBucket()}`;
  const payload: IndexChapterTaskPayload = { storyId, chapterId };
  await enqueueDebounced("indexChapterTask", id, payload);
}

export const onChapterWrite = onDocumentWritten(
  {
    document: "stories/{storyId}/chapters/{chapterId}",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const { storyId, chapterId } = event.params as {
      storyId: string;
      chapterId: string;
    };

    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;

    // 1. Rebuild the cheap title index ONLY on structural changes (create, delete,
    //    title or order change). Autosave fires every ~3s on content edits — those
    //    don't touch the index, so rebuilding then would read every chapter for
    //    nothing. A stale index degrades cost, not correctness (slim context falls
    //    back to a projected read).
    const titleChanged = (before?.title ?? null) !== (after?.title ?? null);
    const orderChanged = (before?.order ?? null) !== (after?.order ?? null);
    const structuralChange =
      before === null || after === null || titleChanged || orderChanged;
    if (structuralChange) {
      try {
        await rebuildChapterIndex(storyId);
      } catch (err) {
        logger.error("rebuildChapterIndex failed", { storyId, err });
      }
    }

    // 2. Vector index. Deletes run immediately (rare). Content (re)embedding is
    //    DEBOUNCED via a Cloud Task so an autosave burst collapses into ~one pass.
    if (!after) {
      if (VECTOR_INDEX_DISABLED) {
        logger.info(
          "emulator: skipping chapter chunk delete (prod would delete)",
          { storyId, chapterId },
        );
      } else {
        const ownerId = await resolveOwnerId(storyId);
        const res = await callAgent(
          "deleteChapterChunks",
          { storyId, chapterId },
          ownerId,
        );
        if (!res.success) {
          logger.warn("deleteChapterChunks failed", {
            storyId,
            chapterId,
            error: res.error,
          });
        }
      }
      return;
    }

    const contentChanged = (before?.content ?? "") !== (after.content ?? "");
    const isNew = before === null;
    if (isNew && !(after.content ?? "")) {
      // Fresh empty chapter (addChapter creates content:""). Nothing to embed yet;
      // the first real autosave will enqueue indexing.
      return;
    }
    if (!isNew && !contentChanged) {
      // Metadata-only change (order/title): no re-embed.
      return;
    }

    if (VECTOR_INDEX_DISABLED) {
      // No retrieval locally, so don't embed. The chapterIndex roster above still
      // updates, keeping the slim chat context working.
      return;
    }

    await enqueueDebouncedIndex(storyId, chapterId);
  },
);
