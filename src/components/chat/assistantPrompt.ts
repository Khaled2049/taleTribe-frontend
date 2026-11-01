// Kept free of React and the panel so any view can ask for the assistant
// without pulling its chunk in; the panel takes the request once it mounts.

export interface AssistantPromptRequest {
  storyId: string;
  prompt: string;
  /** Send at once. Off by default, so the writer can edit first. */
  autoSend?: boolean;
}

let pending: AssistantPromptRequest | null = null;
const listeners = new Set<() => void>();

/** Open the assistant dock with `prompt` in its composer. */
export function openAssistantWith(request: AssistantPromptRequest) {
  pending = { ...request, prompt: request.prompt.trim() };
  for (const listener of listeners) listener();
}

export function subscribeAssistantPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const pendingAssistantPrompt = () => pending;

/** Hand the request for `storyId` to one taker; a request for another story stays. */
export function takeAssistantPrompt(
  storyId: string,
): AssistantPromptRequest | null {
  if (!pending || pending.storyId !== storyId) return null;
  const request = pending;
  pending = null;
  return request;
}
