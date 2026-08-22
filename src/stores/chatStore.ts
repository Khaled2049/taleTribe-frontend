import { create } from "zustand";
import { ChatMessage } from "@/types/IChat";
import { chatService } from "@/services/ChatService";
import { clearChatSession, sendChatMessage } from "@/cloudFunctions/chat";
import { useAuthStore } from "@/stores/authStore";

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  chatId: string | null;
  currentStoryId: string | null;
  initializeChat: (storyId: string) => Promise<void>;
  sendMessage: (storyId: string, message: string) => Promise<void>;
  clearChat: (storyId: string) => Promise<void>;
  clearError: () => void;
  resetChatState: () => void;
}

let unsubscribeMessages: (() => void) | null = null;

const unsubscribeFromMessages = () => {
  if (!unsubscribeMessages) return;
  unsubscribeMessages();
  unsubscribeMessages = null;
};

const getInitialChatState = () => ({
  messages: [] as ChatMessage[],
  isLoading: false,
  error: null as string | null,
  chatId: null as string | null,
  currentStoryId: null as string | null,
});

export const useChatStore = create<ChatStore>((set, get) => ({
  ...getInitialChatState(),
  initializeChat: async (storyId) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      console.warn("Cannot initialize chat: user not authenticated");
      return;
    }

    unsubscribeFromMessages();

    try {
      set({ currentStoryId: storyId, error: null });

      const sessionId = await chatService.getOrCreateChatSession(
        storyId,
        user.uid,
      );
      const history = await chatService.getChatHistory(storyId, sessionId);

      set({
        chatId: sessionId,
        messages: history,
      });

      unsubscribeMessages = chatService.subscribeToMessages(
        storyId,
        sessionId,
        (updatedMessages) => {
          set({ messages: updatedMessages });
        },
      );
    } catch (error) {
      console.error("Error initializing chat:", error);
      set({ error: "Failed to initialize chat. Please try again." });
    }
  },
  sendMessage: async (storyId, message) => {
    const { user } = useAuthStore.getState();
    const { chatId } = get();

    if (!user || !chatId) {
      set({ error: "Cannot send message: chat not initialized" });
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      set({ error: "Message cannot be empty" });
      return;
    }

    set({ isLoading: true, error: null });

    const optimisticUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, optimisticUserMessage],
    }));

    try {
      await sendChatMessage({
        storyId,
        chatId,
        message: trimmedMessage,
        includeFullContext: true,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to send message. Please try again.";
      console.error("Error sending message:", error);
      set((state) => ({
        error: errorMessage,
        messages: state.messages.filter((msg) => !msg.id.startsWith("temp-")),
      }));
    } finally {
      set({ isLoading: false });
    }
  },
  clearChat: async (storyId) => {
    const { chatId } = get();
    if (!chatId) return;

    unsubscribeFromMessages();
    set({ messages: [], error: null });

    try {
      await clearChatSession({ storyId, chatId });
    } catch (error) {
      console.error("Error clearing chat session:", error);
    }

    set({ chatId: null });
    await get().initializeChat(storyId);
  },
  clearError: () => set({ error: null }),
  resetChatState: () => {
    unsubscribeFromMessages();
    set(getInitialChatState());
  },
}));
