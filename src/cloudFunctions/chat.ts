import api, { getApiErrorMessage } from "./index";
import { SendChatMessageRequest, SendChatMessageResponse } from "@/types/IChat";

export const sendChatMessage = async (
  request: SendChatMessageRequest,
): Promise<SendChatMessageResponse> => {
  try {
    const response = await api.post<SendChatMessageResponse>(
      "/sendChatMessage",
      request,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, "Failed to send chat message"));
  }
};

export const clearChatSession = async (request: {
  storyId: string;
  chatId: string;
}): Promise<void> => {
  try {
    await api.post("/clearChatSession", request);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, "Failed to clear chat session"));
  }
};
