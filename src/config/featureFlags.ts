// Master switch for crypto/web3 features (connect wallet, tipping, earnings).
// Set to true to re-enable. Kept off while monetization is deprioritized.
export const WEB3_ENABLED = false;

// Read-aloud (client-side Kokoro TTS) in the story reader. Kill switch for a
// feature with a heavy first-use model download (~90–300 MB, cached).
export const READ_ALOUD_ENABLED = true;

// The story assistant. Presentation only: the gateway independently enforces
// ASSISTANT_API_ENABLED, story ownership and quota, so turning this on in a
// browser that the server has not enabled yields 404s, not access.
export const ASSISTANT_UI_ENABLED =
  import.meta.env.VITE_ASSISTANT_UI_ENABLED === "true";
