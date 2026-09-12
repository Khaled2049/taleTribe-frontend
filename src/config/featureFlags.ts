// Master switch for crypto/web3 features (connect wallet, tipping, earnings).
// Set to true to re-enable. Kept off while monetization is deprioritized.
export const WEB3_ENABLED = false;

// Read-aloud (client-side Kokoro TTS) in the story reader. Kill switch for a
// feature with a heavy first-use model download (~90–300 MB, cached).
export const READ_ALOUD_ENABLED = true;

// Phase 0 prototype is development-only. The gateway independently authorizes it.
export const ASSISTANT_UI_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ASSISTANT_UI_ENABLED === "true";
export const ASSISTANT_LEGACY_FALLBACK_ENABLED =
  import.meta.env.VITE_ASSISTANT_LEGACY_FALLBACK_ENABLED !== "false";
