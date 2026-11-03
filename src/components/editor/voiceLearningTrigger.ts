// The server still enforces evidence and rate limits; this only keeps autosave
// from calling the learning Function after every save.

// A pass that ran blocks the story for 30 minutes server-side.
export const VOICE_LEARNING_AFTER_PASS_MS = 30 * 60 * 1000;
export const VOICE_LEARNING_AFTER_SKIP_MS = 10 * 60 * 1000;

const nextAllowedAt = new Map<string, number>();

/** `learnFromWriting` is the cached profile switch, undefined when not loaded. */
export function shouldRequestVoiceLearning(
  storyId: string,
  now: number,
  learnFromWriting: boolean | undefined,
): boolean {
  if (learnFromWriting === false) return false;
  return now >= (nextAllowedAt.get(storyId) ?? 0);
}

// Recorded when sent, not answered, so saves during the request wait too.
export function recordVoiceLearningRequest(storyId: string, now: number): void {
  nextAllowedAt.set(storyId, now + VOICE_LEARNING_AFTER_SKIP_MS);
}

export function recordVoiceLearningResult(
  storyId: string,
  now: number,
  status: string | undefined,
): void {
  if (status === "updated" || status === "analyzed") {
    nextAllowedAt.set(storyId, now + VOICE_LEARNING_AFTER_PASS_MS);
  }
}

export function resetVoiceLearningThrottle(): void {
  nextAllowedAt.clear();
}
