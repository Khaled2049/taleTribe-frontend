/**
 * CORS configuration for Firebase Functions.
 *
 * Production allows trusted web origins and the bundled iOS reader origin.
 * Localhost origins are allowed only in the emulator.
 */
import corsLib from "cors";

const productionOrigins = [
  "https://story-6f89f.web.app",
  "https://thetaletribe.com",
  "https://www.thetaletribe.com",
  "tauri://localhost",
];

const developmentOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

export function getAllowedOrigins(env = process.env): string[] {
  const isEmulator = env.FUNCTIONS_EMULATOR === "true";
  const extraOriginsRaw = env.CORS_EXTRA_ORIGINS ?? "";
  const extraOrigins = extraOriginsRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return isEmulator
    ? [...productionOrigins, ...developmentOrigins, ...extraOrigins]
    : [...productionOrigins, ...extraOrigins];
}

export const corsOptions = {
  cors: getAllowedOrigins(),
  invoker: "public",
};

/**
 * Manual CORS middleware for endpoints that get polled/mounted often (e.g.
 * credit balance). `onRequest`'s built-in `cors` option only forwards
 * `origin` to the underlying `cors` package — it has no way to set
 * `Access-Control-Max-Age`, so every cross-origin GET pays for a fresh
 * OPTIONS preflight (and a separate Function invocation) since the browser
 * can't cache the previous one. Applying `cors` ourselves lets us set
 * `maxAge` so browsers reuse the preflight for an hour instead.
 *
 * Use in place of `corsOptions` on `onRequest`: pass `{ invoker: "public" }`
 * as the options arg and call this middleware first inside the handler.
 */
export const corsMiddlewareWithMaxAge = corsLib({
  origin: getAllowedOrigins(),
  maxAge: 3600,
});
