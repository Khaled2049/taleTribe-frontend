/**
 * SEO Configuration
 * Default meta tags and SEO constants for the application
 */

// Application name from environment variable (allows easy rebranding)
export const APP_NAME = import.meta.env.VITE_APP_NAME || "TheTaleTribe";

// Get the base URL from environment or use a default
const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Fallback for SSR or build time
  return import.meta.env.VITE_SITE_URL || "https://thetaletribe.web.app";
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
  defaultImage: "/book.svg", // Default OG image
  twitterHandle: "", // Add if you have a Twitter handle
  facebookAppId: "", // Add if you have a Facebook App ID
  author: `${APP_NAME} Team`,
  language: "en",
  locale: "en_US",
} as const;

/**
 * Truncate text to a specific length for meta descriptions
 */
export const truncateDescription = (
  text: string,
  maxLength: number = 160,
): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

/**
 * Generate absolute URL from a relative path
 */
export const getAbsoluteUrl = (path: string): string => {
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
