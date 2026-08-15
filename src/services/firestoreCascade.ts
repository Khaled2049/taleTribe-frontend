import { DocumentReference, writeBatch } from "firebase/firestore";
import { firestore } from "@/config/firebase";

/**
 * Firestore caps a batch at 500 writes. A cascade over a busy document can
 * exceed that once child collections are counted, and an oversized batch fails
 * whole rather than partially — so deletes commit in chunks.
 */
const DELETE_CHUNK = 400;

export const commitInChunks = async (
  refs: DocumentReference[],
): Promise<void> => {
  for (let i = 0; i < refs.length; i += DELETE_CHUNK) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + DELETE_CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};
