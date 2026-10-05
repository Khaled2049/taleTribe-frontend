/** sitemap.xml and its children, built from story-data's published catalogue. */
import { escapeHtml } from "./html";
import { GENRES, genrePath, profilePath, storyPath } from "./paths";
import { absoluteUrl } from "./site";
import { getSitemapPage, type SitemapEntry } from "./storyData";

// The protocol caps one file at 50,000 URLs; stop short of it.
const MAX_URLS_PER_FILE = 45000;
const CATALOG_TTL_MS = 10 * 60 * 1000;

const STATIC_PATHS = [
  "/",
  "/stories",
  ...GENRES.map((genre) => genrePath(genre.value)),
  "/competitions",
  "/competitions/how-it-works",
  "/book-clubs",
  "/help",
  "/privacy-policy",
  "/terms-of-use",
];

interface SitemapUrl {
  path: string;
  lastmod?: string;
}

let cached: { at: number; entries: Promise<SitemapEntry[]> } | null = null;

async function walkCatalog(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  let cursor = "";
  do {
    const page = await getSitemapPage(cursor);
    entries.push(...page.stories);
    cursor = page.nextCursor ?? "";
  } while (cursor && entries.length < MAX_URLS_PER_FILE);
  if (cursor) console.warn(`sitemap truncated at ${entries.length} stories; shard stories.xml`);
  return entries.slice(0, MAX_URLS_PER_FILE);
}

/** Shared by stories.xml and authors.xml so a crawl of both walks the catalogue once. */
function catalog(): Promise<SitemapEntry[]> {
  if (!cached || Date.now() - cached.at > CATALOG_TTL_MS) {
    const entries = walkCatalog();
    cached = { at: Date.now(), entries };
    // A failed walk must not be served from cache for the next ten minutes.
    entries.catch(() => {
      if (cached?.entries === entries) cached = null;
    });
  }
  return cached.entries;
}

export const resetSitemapCache = (): void => {
  cached = null;
};

const XML_HEADER = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";

function urlset(urls: SitemapUrl[]): string {
  const body = urls.map(({ path, lastmod }) =>
    `  <url><loc>${escapeHtml(absoluteUrl(path))}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ""}</url>`);
  return `${XML_HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body.join("\n")}\n</urlset>\n`;
}

const CHILDREN = ["/sitemaps/pages.xml", "/sitemaps/stories.xml", "/sitemaps/authors.xml"];

/** Returns the XML for a sitemap path, or null when the path is not one. */
export async function renderSitemap(pathname: string): Promise<string | null> {
  if (pathname === "/sitemap.xml") {
    const children = CHILDREN.map((path) => `  <sitemap><loc>${escapeHtml(absoluteUrl(path))}</loc></sitemap>`);
    return `${XML_HEADER}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${children.join("\n")}\n</sitemapindex>\n`;
  }
  if (pathname === "/sitemaps/pages.xml") return urlset(STATIC_PATHS.map((path) => ({ path })));
  if (pathname === "/sitemaps/stories.xml") {
    return urlset((await catalog()).map((story) => ({
      path: storyPath(story.id, story.title),
      lastmod: story.updatedAt,
    })));
  }
  if (pathname === "/sitemaps/authors.xml") {
    // An author's page changes when their newest story does; entries arrive newest first.
    const authors = new Map<string, string>();
    for (const story of await catalog()) {
      if (!authors.has(story.authorId)) authors.set(story.authorId, story.updatedAt);
    }
    return urlset([...authors].map(([userId, lastmod]) => ({ path: profilePath(userId), lastmod })));
  }
  return null;
}
