/**
 * The client never imports firebase. `platform-auth` owns the Firebase app and
 * injects a token provider here at bootstrap, which keeps the dependency going
 * one way: platform-auth -> story-data-client. The auth store already imports
 * profileRepo, so a firebase import here would close that into a cycle.
 *
 * Injecting `baseUrl` rather than reading `import.meta.env` is what lets this
 * package load under vitest, where Vite never defines it.
 */
export interface StoryDataAuthContext {
  uid: string;
  token: string | null;
}

export interface StoryDataConfig {
  baseUrl: string;
  getAuthContext: () => Promise<StoryDataAuthContext | null>;
  /**
   * Synchronous uid, for mappers that stamp ownership onto a decoded entity and
   * cannot await. Separate from `getAuthContext` because a token fetch may hit
   * the network; this one must resolve in the same tick as the decode.
   */
  getUid: () => string | null;
  /** Mirrors story-data's `AUTH_MODE=dev`, which accepts `X-User-ID`. */
  sendDevUserHeader?: boolean;
}

let config: StoryDataConfig | null = null;

export function configureStoryData(next: StoryDataConfig): void {
  config = next;
}

export function getStoryDataConfig(): StoryDataConfig {
  if (!config) {
    throw new Error(
      "story-data client is not configured. Call configureStoryData() during app bootstrap.",
    );
  }
  return config;
}
