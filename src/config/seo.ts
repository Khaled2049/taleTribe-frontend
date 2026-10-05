/**
 * SEO Configuration
 * Default meta tags and SEO constants for the application
 */

// Application name from environment variable (allows easy rebranding)
export const APP_NAME = import.meta.env.VITE_APP_NAME || "TheTaleTribe";

// KEEP IN SYNC with DEFAULT_SITE_URL in vite.config.ts and siteUrl() in
// functions/src/seo/site.ts.
const DEFAULT_SITE_URL = "https://thetaletribe.com";

/**
 * The one origin canonical and social URLs are built on. Deliberately not
 * `window.location.origin`: the site also answers on its *.web.app and www
 * hosts, and a canonical that follows the visitor's host tells a crawler each
 * of them is the original.
 */
const getBaseUrl = () => {
  const configured = import.meta.env.VITE_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return import.meta.env.DEV && typeof window !== "undefined"
    ? window.location.origin
    : DEFAULT_SITE_URL;
};

export const SEO_CONFIG = {
  siteName: APP_NAME,
  siteUrl: getBaseUrl(),
  defaultTitle: `${APP_NAME} — Where Your Stories Live`,
  defaultDescription:
    "Create, organize, and enhance your stories with AI-powered writing assistants. Join book clubs, discover stories, and connect with writers in a collaborative writing community.",
  defaultKeywords: [
    "novel writing",
    "AI writing assistant",
    "story creation",
    "book clubs",
    "writing platform",
    "creative writing",
    "storytelling",
    "author tools",
    "writing community",
    "story collaboration",
  ],
  // Social crawlers reject SVG, so this must stay a raster image.
  defaultImage: "/og-default.png",
  twitterHandle: "", // Add if you have a Twitter handle
  facebookAppId: "", // Add if you have a Facebook App ID
  author: `${APP_NAME} Team`,
  language: "en",
  locale: "en_US",
} as const;

/**
 * Truncate text for a meta description, on a word boundary.
 */
export const truncateDescription = (
  text: string,
  maxLength: number = 160,
): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s.,;:!?-]+$/, "")}…`;
};

/**
 * Generate absolute URL from a relative path. An already-absolute URL (a cover
 * in Cloud Storage) is returned as is.
 */
export const getAbsoluteUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = SEO_CONFIG.siteUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

/**
 * Generate canonical URL for a page
 */
export const getCanonicalUrl = (path: string): string => {
  return getAbsoluteUrl(path);
};
