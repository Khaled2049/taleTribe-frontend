import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrCreateChatSession: vi.fn(),
  getChatHistory: vi.fn(),
  subscribeToMessages: vi.fn(),
  send: vi.fn(),
  clear: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/services/ChatService", () => ({ chatService: mocks }));
vi.mock("@/cloudFunctions/chat", () => ({
  sendChatMessage: mocks.send,
  clearChatSession: mocks.clear,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ user: { uid: "u1" } }) },
}));
import { useChatStore } from "@/stores/chatStore";

beforeEach(() => {
  useChatStore.getState().resetChatState();
  vi.resetAllMocks();
  mocks.getOrCreateChatSession.mockResolvedValue("chat-1");
  mocks.getChatHistory.mockResolvedValue([]);
  mocks.subscribeToMessages.mockReturnValue(mocks.unsubscribe);
});

describe("legacy chat baseline", () => {
  it("starts a session, loads history and receives persisted replies", async () => {
    const history = [
      {
        id: "m1",
        role: "assistant",
        content: "Fixture reply",
        timestamp: new Date(0),
      },
    ];
    mocks.getChatHistory.mockResolvedValue(history);
    await useChatStore.getState().initializeChat("s1");
    expect(mocks.getOrCreateChatSession).toHaveBeenCalledWith("s1", "u1");
    expect(useChatStore.getState().messages).toEqual(history);
    await useChatStore.getState().sendMessage("s1", "  Fixture question  ");
    expect(mocks.send).toHaveBeenCalledWith({
      storyId: "s1",
      chatId: "chat-1",
      message: "Fixture question",
      includeFullContext: true,
    });
    mocks.subscribeToMessages.mock.calls[0][2](history);
    expect(useChatStore.getState().messages).toEqual(history);
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it("clears the thread and initializes a fresh session", async () => {
    await useChatStore.getState().initializeChat("s1");
    mocks.getOrCreateChatSession.mockResolvedValue("chat-2");
    await useChatStore.getState().clearChat("s1");
    expect(mocks.clear).toHaveBeenCalledWith({
      storyId: "s1",
      chatId: "chat-1",
    });
    expect(mocks.unsubscribe).toHaveBeenCalled();
    expect(useChatStore.getState().chatId).toBe("chat-2");
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it.each(["Daily AI quota exceeded", "AI backend is unreachable"])(
    "shows %s and removes the optimistic message",
    async (message) => {
      await useChatStore.getState().initializeChat("s1");
      mocks.send.mockRejectedValue(new Error(message));
      await useChatStore.getState().sendMessage("s1", "Fixture question");
      expect(useChatStore.getState().error).toBe(message);
      expect(useChatStore.getState().messages).toEqual([]);
      expect(useChatStore.getState().isLoading).toBe(false);
    },
  );
});
