/** Turns a page model into the SPA shell with its head and a content snapshot filled in. */
import { siteName } from "./site";

export interface Page {
  status: number;
  title: string;
  description: string;
  /** Absolute. Omitted for a page that should not declare one (a 404). */
  canonical?: string;
  index: boolean;
  ogType: "website" | "book" | "article" | "profile";
  image: string;
  /** summary_large_image crops a portrait book cover to its middle third. */
  largeImage: boolean;
  jsonLd: object[];
  /** Trusted HTML: every interpolated value must already be escaped. */
  snapshot: string;
  /** Cross-origin JSON the app requests on boot, fetched alongside its script. */
  preload?: string[];
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Cuts on a word boundary so a description never ends mid-word. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

/**
 * Chapter HTML to plain paragraphs. Tags are dropped rather than sanitized:
 * the snapshot is replaced by the real reader on boot, so it needs the words,
 * not the markup, and text that is escaped afterwards cannot carry script.
 */
export function htmlToParagraphs(html: string, maxChars: number): string[] {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    });
  const paragraphs: string[] = [];
  let used = 0;
  for (const raw of text.split("\n")) {
    const paragraph = raw.replace(/\s+/g, " ").trim();
    if (!paragraph) continue;
    if (used + paragraph.length > maxChars) {
      const room = maxChars - used;
      if (room > 200) paragraphs.push(truncate(paragraph, room));
      break;
    }
    paragraphs.push(paragraph);
    used += paragraph.length;
  }
  return paragraphs;
}

/** `</script>` inside a JSON string would end the block early. */
const jsonForScript = (value: object): string => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * Tags carry data-rh so react-helmet-async adopts them on boot instead of
 * appending a second description and canonical beside them. JSON-LD does not:
 * Helmet would remove a block it adopted, and Google reads the rendered DOM.
 */
export function headTags(page: Page): string {
  const meta = (attr: "name" | "property", key: string, content: string) =>
    `<meta ${attr}="${key}" content="${escapeHtml(content)}" data-rh="true" />`;
  const title = escapeHtml(page.title);
  const tags = [
    `<title>${title}</title>`,
    meta("name", "description", page.description),
    meta("name", "robots", page.index ? "index, follow, max-image-preview:large" : "noindex, follow"),
    meta("property", "og:type", page.ogType),
    meta("property", "og:site_name", siteName()),
    meta("property", "og:title", page.title),
    meta("property", "og:description", page.description),
    meta("property", "og:image", page.image),
    meta("property", "og:locale", "en_US"),
    meta("name", "twitter:card", page.largeImage ? "summary_large_image" : "summary"),
    meta("name", "twitter:title", page.title),
    meta("name", "twitter:description", page.description),
    meta("name", "twitter:image", page.image),
  ];
  if (page.canonical) {
    tags.push(
      `<link rel="canonical" href="${escapeHtml(page.canonical)}" data-rh="true" />`,
      meta("property", "og:url", page.canonical),
    );
  }
  for (const url of page.preload ?? []) {
    tags.push(`<link rel="preload" as="fetch" crossorigin="anonymous" href="${escapeHtml(url)}" />`);
  }
  for (const block of page.jsonLd) {
    tags.push(`<script type="application/ld+json">${jsonForScript(block)}</script>`);
  }
  return tags.join("\n    ");
}

const HELMET_OWNED = /[ \t]*<(?:meta|link)\b[^>]*\bdata-rh="true"[^>]*>\s*?\n?/gi;
const TITLE = /[ \t]*<title>[\s\S]*?<\/title>\s*?\n?/i;
const ROOT = /<div id="root">\s*<\/div>/;

/** Returns null when the shell is not the one this was written against. */
export function renderDocument(template: string, page: Page): string | null {
  if (!template.includes("</head>") || !ROOT.test(template)) return null;
  // Function replacements: a "$&" in a story title must not be read as a pattern.
  return template
    .replace(HELMET_OWNED, "")
    .replace(TITLE, "")
    .replace("</head>", () => `  ${headTags(page)}\n  </head>`)
    .replace(ROOT, () => `<div id="root">${page.snapshot}</div>`);
}
