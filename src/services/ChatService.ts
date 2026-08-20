import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  limit,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "@novelsync/platform-auth";
import { ChatMessage, ChatSession } from "@/types/IChat";

class ChatService {
  private storiesCollection = collection(firestore, "stories");

  /**
   * Get or create a chat session for a story.
   * Returns the chatId of the most recent session, or creates a new one if none exists.
   */
  async getOrCreateChatSession(
    storyId: string,
    userId: string,
  ): Promise<string> {
    try {
      const chatsRef = collection(this.storiesCollection, storyId, "chats");

      // Filtered by owner because the read rule is a field compare on the
      // session's uid — an unfiltered list could return someone else's and is
      // denied outright.
      const chatsSnapshot = await getDocs(
        query(
          chatsRef,
          where("userId", "==", userId),
          orderBy("updatedAt", "desc"),
          limit(1),
        ),
      );

      if (!chatsSnapshot.empty) {
        const chatId = chatsSnapshot.docs[0].id;
        console.log("Found existing chat session:", chatId);
        return chatId;
      }

      // Create new chat session
      const newChatRef = doc(chatsRef);
      const newChatId = newChatRef.id;

      const newChat: Omit<ChatSession, "id"> = {
        userId,
        storyId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
      };

      await setDoc(newChatRef, { id: newChatId, ...newChat });
      console.log("Created new chat session:", newChatId);
      return newChatId;
    } catch (error) {
      console.error("Error getting or creating chat session:", error);
      throw error;
    }
  }

  /**
   * Subscribe to chat messages in real-time.
   * Returns an unsubscribe function to stop listening.
   */
  subscribeToMessages(
    storyId: string,
    chatId: string,
    callback: (messages: ChatMessage[]) => void,
  ): Unsubscribe {
    const messagesRef = collection(
      this.storiesCollection,
      storyId,
      "chats",
      chatId,
      "messages",
    );

    const q = query(messagesRef, orderBy("timestamp", "asc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            role: data.role,
            content: data.content,
            timestamp:
              data.timestamp instanceof Timestamp
                ? data.timestamp.toDate()
                : new Date(),
          } as ChatMessage;
        });

        callback(messages);
      },
      (error) => {
        console.error("Error listening to messages:", error);
      },
    );
  }

  /**
   * Get chat history (for loading initial state).
   * Returns messages in chronological order (oldest first).
   */
  async getChatHistory(
    storyId: string,
    chatId: string,
  ): Promise<ChatMessage[]> {
    try {
      const messagesRef = collection(
        this.storiesCollection,
        storyId,
        "chats",
        chatId,
        "messages",
      );

      const q = query(messagesRef, orderBy("timestamp", "asc"));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp:
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : new Date(),
        } as ChatMessage;
      });
    } catch (error) {
      console.error("Error getting chat history:", error);
      return [];
    }
  }
}

export const chatService = new ChatService();
