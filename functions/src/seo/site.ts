/** Deployment facts the renderer needs. Read per call so tests can set them. */

export const siteUrl = (): string =>
  (process.env.SITE_URL || "https://thetaletribe.com").replace(/\/+$/, "");

export const siteName = (): string => process.env.SITE_NAME || "TheTaleTribe";

export const storyDataUrl = (): string =>
  (process.env.STORY_DATA_URL || "http://localhost:8084").replace(/\/+$/, "");

/**
 * Where the built SPA shell lives. Fetched from Hosting rather than bundled
 * because Functions and Hosting do not release atomically: a bundled copy
 * would point at hashed assets the live site no longer serves.
 */
export function templateUrl(): string {
  if (process.env.SEO_TEMPLATE_URL) return process.env.SEO_TEMPLATE_URL;
  if (process.env.FUNCTIONS_EMULATOR === "true") return "http://127.0.0.1:5033/index.html";
  return `https://${process.env.GCLOUD_PROJECT}.web.app/index.html`;
}

export const DEFAULT_IMAGE_PATH = "/og-default.png";

export const absoluteUrl = (pathOrUrl: string): string =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
