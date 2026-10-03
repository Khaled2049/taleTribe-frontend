import { firestore } from "@novelsync/platform-auth/firestore";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { IMessage } from "@/types/IMessage";
import { RATE_LIMITS } from "@/config/rateLimits";
import { spoilerRangeField } from "@/lib/spoilerRange";

// Chat is the one book club feature still in Firestore, kept for realtime
// delivery. It lives apart from bookClubRepo so that only the chat panel, not
// every book club page, pulls in the Firestore SDK.
export const bookClubChatRepo = {
  async sendMessage(clubId: string, message: IMessage): Promise<string> {
    if (message.content.length > RATE_LIMITS.MAX_MESSAGE_SIZE_CHARS)
      throw new Error(
        `Message is too long. Maximum ${RATE_LIMITS.MAX_MESSAGE_SIZE_CHARS} characters allowed.`,
      );
    const ref = doc(collection(firestore, `bookClubs/${clubId}/messages`));
    const { spoilerChapterRange, ...rest } = message;
    await setDoc(ref, {
      ...rest,
      ...spoilerRangeField(spoilerChapterRange),
      id: ref.id,
      timestamp: serverTimestamp(),
    });
    return ref.id;
  },

  getMessages(clubId: string, callback: (messages: IMessage[]) => void) {
    return onSnapshot(
      query(
        collection(firestore, `bookClubs/${clubId}/messages`),
        orderBy("timestamp", "desc"),
        limit(50),
      ),
      (snapshot) =>
        callback(snapshot.docs.map((x) => x.data() as IMessage).reverse()),
    );
  },
};
