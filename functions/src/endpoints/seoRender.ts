/**
 * Serves crawlable HTML for public routes and the sitemap. Firebase Hosting
 * rewrites those paths here (firebase.json); every other path still gets the
 * static shell. The response is the same SPA shell a browser would have
 * received, with the page's head tags, JSON-LD and a text snapshot filled in,
 * so link previews and crawlers that do not run JavaScript see real content.
 *
 * Failure is designed to be invisible: if story-data is unreachable the plain
 * shell goes out uncached and the app renders client-side as it always did.
 */
import { onRequest } from "firebase-functions/v2/https";
import { renderDocument } from "../seo/html";
import { resolvePage } from "../seo/pages";
import { renderSitemap } from "../seo/sitemap";
import { templateUrl } from "../seo/site";

// max-age=0 keeps browsers revalidating, so a deploy's new asset hashes are
// never pinned behind a cached document; Hosting's CDN absorbs the traffic.
const PAGE_CACHE = "public, max-age=0, s-maxage=300";
const MISSING_CACHE = "public, max-age=0, s-maxage=60";
const SITEMAP_CACHE = "public, max-age=0, s-maxage=3600";
const TEMPLATE_TIMEOUT_MS = 3000;

// Hosting's security headers (firebase.json) are documented for static files.
// Copying them off the shell's own response keeps one source of truth and
// guarantees a rendered page is never served with a weaker policy than the app.
const SECURITY_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];

interface Shell {
  html: string;
  etag: string | null;
  headers: Record<string, string>;
}

let template: Shell | null = null;

/**
 * Revalidated on every render rather than on a timer. A conditional GET to the
 * CDN is cheap, and a shell held past a deploy would name deleted assets and
 * then sit in the page cache for five minutes.
 */
async function loadTemplate(): Promise<Shell> {
  try {
    const response = await fetch(templateUrl(), {
      headers: template?.etag ? { "If-None-Match": template.etag } : {},
      signal: AbortSignal.timeout(TEMPLATE_TIMEOUT_MS),
    });
    if (response.status === 304 && template) return template;
    if (!response.ok) throw new Error(`shell fetch failed (${response.status})`);
    const headers: Record<string, string> = {};
    for (const name of SECURITY_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }
    template = { html: await response.text(), etag: response.headers.get("etag"), headers };
    return template;
  } catch (error) {
    if (template) return template;
    throw error;
  }
}

export const seoRender = onRequest(
  { invoker: "public", memory: "256MiB", timeoutSeconds: 30, maxInstances: 10, concurrency: 80 },
  async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.set("Allow", "GET, HEAD").status(405).send("Method not allowed");
      return;
    }
    const url = new URL(req.originalUrl, "http://localhost");

    if (url.pathname === "/sitemap.xml" || url.pathname.startsWith("/sitemaps/")) {
      try {
        const xml = await renderSitemap(url.pathname);
        if (xml === null) {
          res.status(404).send("Not found");
          return;
        }
        res.set("Content-Type", "application/xml; charset=utf-8").set("Cache-Control", SITEMAP_CACHE).send(xml);
      } catch (error) {
        // 503, not an empty sitemap: Google retries an outage but trusts an empty file.
        console.error("sitemap render failed", error);
        res.set("Retry-After", "600").status(503).send("Sitemap temporarily unavailable");
      }
      return;
    }

    let shell: string;
    try {
      const loaded = await loadTemplate();
      shell = loaded.html;
      res.set(loaded.headers);
    } catch (error) {
      console.error("SPA shell unavailable", error);
      res.set("Retry-After", "30").status(503).send("Temporarily unavailable");
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");

    try {
      const resolution = await resolvePage(url.pathname, url.searchParams);
      if (resolution?.kind === "redirect") {
        res.set("Cache-Control", PAGE_CACHE).redirect(301, `${resolution.location}${url.search}`);
        return;
      }
      const html = resolution ? renderDocument(shell, resolution.page) : null;
      if (resolution && html) {
        const missing = resolution.page.status === 404;
        res.set("Cache-Control", missing ? MISSING_CACHE : PAGE_CACHE).status(resolution.page.status).send(html);
        return;
      }
    } catch (error) {
      console.error(`seo render failed for ${url.pathname}`, error);
    }
    res.set("Cache-Control", "no-store").send(shell);
  },
);
