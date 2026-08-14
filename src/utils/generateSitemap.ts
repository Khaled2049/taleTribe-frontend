/**
 * Sitemap Generation Utility
 * Generates sitemap.xml for SEO purposes
 */

import { getAbsoluteUrl } from "@/config/seo";

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

/**
 * Generate sitemap XML string from entries
 */
export const generateSitemapXML = (entries: SitemapEntry[]): string => {
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const urlEntries = entries
    .map((entry) => {
      const url = entry.url.startsWith("http")
        ? entry.url
        : getAbsoluteUrl(entry.url);
      return `  <url>
    <loc>${escapeXML(url)}</loc>${
      entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ""
    }${
      entry.changefreq
        ? `\n    <changefreq>${entry.changefreq}</changefreq>`
        : ""
    }${
      entry.priority !== undefined
        ? `\n    <priority>${entry.priority}</priority>`
        : ""
    }
  </url>`;
    })
    .join("\n");

  return `${xmlHeader}
${urlEntries}
</urlset>`;
};

/**
 * Escape XML special characters
 */
const escapeXML = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Get static sitemap entries (pages that don't change dynamically)
 */
export const getStaticSitemapEntries = (): SitemapEntry[] => {
  const now = new Date().toISOString().split("T")[0];

  return [
    {
      url: "/",
      lastmod: now,
      changefreq: "daily",
      priority: 1.0,
    },
    {
      url: "/stories",
      lastmod: now,
      changefreq: "daily",
      priority: 0.9,
    },
    {
      url: "/explore",
      lastmod: now,
      changefreq: "daily",
      priority: 0.9,
    },
    {
      url: "/explore/stories",
      lastmod: now,
      changefreq: "daily",
      priority: 0.8,
    },
    {
      url: "/explore/competitions",
      lastmod: now,
      changefreq: "weekly",
      priority: 0.7,
    },
    {
      url: "/book-clubs",
      lastmod: now,
      changefreq: "daily",
      priority: 0.8,
    },
    {
      url: "/privacy-policy",
      lastmod: now,
      changefreq: "yearly",
      priority: 0.3,
    },
    {
      url: "/terms-of-use",
      lastmod: now,
      changefreq: "yearly",
      priority: 0.3,
    },
  ];
};

/**
 * Generate dynamic sitemap entries for stories
 * This would typically fetch from Firestore
 */
export const generateStorySitemapEntries = (
  stories: Array<{ id: string; updatedAt: Date }>,
): SitemapEntry[] => {
  return stories.map((story) => ({
    url: `/story/${story.id}`,
    lastmod: story.updatedAt.toISOString().split("T")[0],
    changefreq: "weekly",
    priority: 0.8,
  }));
};

/**
 * Generate dynamic sitemap entries for book clubs
 */
export const generateBookClubSitemapEntries = (
  clubs: Array<{ id: string; updatedAt?: Date }>,
): SitemapEntry[] => {
  const now = new Date().toISOString().split("T")[0];
  return clubs.map((club) => ({
    url: `/book-clubs/${club.id}`,
    lastmod: club.updatedAt ? club.updatedAt.toISOString().split("T")[0] : now,
    changefreq: "weekly",
    priority: 0.7,
  }));
};
