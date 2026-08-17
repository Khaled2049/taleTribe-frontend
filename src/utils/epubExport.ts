import JSZip from "jszip";
import { Chapter, StoryMetadata } from "@/types/IStory";

export interface EpubCoverAsset {
  bytes: ArrayBuffer;
  mediaType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
}

type EpubStoryInput = Pick<
  StoryMetadata,
  "title" | "author" | "description" | "language" | "copyright" | "tags"
>;

/** `story.language` is a display string (see LANGUAGES in constants/storyOptions.ts),
 * but EPUB's dc:language requires a BCP-47 code. */
const LANGUAGE_TO_ISO: Record<string, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Italian: "it",
  Portuguese: "pt",
  Dutch: "nl",
  Russian: "ru",
  Chinese: "zh",
  Japanese: "ja",
  Korean: "ko",
  Arabic: "ar",
  Hindi: "hi",
};

function toIsoLanguage(language?: string): string {
  if (!language) return "en";
  return LANGUAGE_TO_ISO[language] ?? "en";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const VALID_XML_NAME = /^[A-Za-z_][\w.-]*$/;
const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function safeHref(rawHref: string): string {
  const href = rawHref.trim();
  if (!href) return "#";
  // eslint-disable-next-line no-control-regex
  const withoutControls = href.replace(/[\u0000-\u0020\u007f]/g, "");
  const scheme = withoutControls.match(/^([a-zA-Z][\w+.-]*):/);
  if (!scheme) return href; // relative, fragment, or protocol-relative path
  return SAFE_LINK_SCHEMES.has(scheme[1].toLowerCase() + ":") ? href : "#";
}

/**
 * Strips inline chapter images (out of scope for v1) and neutralizes anything
 * executable, then re-serializes via XMLSerializer so void elements are
 * self-closed and entities are escaped correctly — TipTap's HTML5 output isn't
 * valid XHTML as-is, which EPUB spine documents require.
 */
function cleanChapterHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const body = doc.body;

  body.querySelectorAll("img, script, style").forEach((el) => el.remove());

  // Drop elements with a namespaced/invalid tag name — e.g. <o:p>, <v:shape>
  // left over from pasted Word/Office content. HTML5 parses these fine (as an
  // unrecognized element, tag name kept verbatim), but they aren't valid XML
  // element names and break XHTML serialization.
  body.querySelectorAll("*").forEach((el) => {
    if (!VALID_XML_NAME.test(el.tagName)) {
      el.remove();
    }
  });

  body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const isEventHandler = attr.name.toLowerCase().startsWith("on");
      if (isEventHandler || !VALID_XML_NAME.test(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === "A") {
      el.setAttribute("href", safeHref(el.getAttribute("href") || ""));
    }
  });

  const serializer = new XMLSerializer();
  return Array.from(body.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join("\n");
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode cover image."));
    };
    img.src = url;
  });
}

async function convertToJpeg(blob: Blob): Promise<Blob> {
  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to convert cover image."));
      },
      "image/jpeg",
      0.9,
    );
  });
}

/**
 * Fetches the story cover (converting to JPEG if it's WebP or anything else
 * EPUB readers render unreliably as a cover) for embedding. Never throws —
 * callers should treat `null` as "no cover" and still produce an EPUB.
 */
export async function fetchCoverAsset(
  coverUrl: string | undefined,
): Promise<EpubCoverAsset | null> {
  if (!coverUrl) return null;
  try {
    const response = await fetch(coverUrl);
    if (!response.ok) return null;

    let blob = await response.blob();
    if (blob.type !== "image/jpeg" && blob.type !== "image/png") {
      blob = await convertToJpeg(blob);
    }

    const isPng = blob.type === "image/png";
    const bytes = await blob.arrayBuffer();
    return {
      bytes,
      mediaType: isPng ? "image/png" : "image/jpeg",
      extension: isPng ? "png" : "jpg",
    };
  } catch (error) {
    console.warn("Failed to fetch cover image for EPUB export:", error);
    return null;
  }
}

/** Produces a filesystem-safe .epub filename from the story title. */
export function toEpubFilename(title: string): string {
  const cleaned = (title || "Untitled Story")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned.slice(0, 80) || "Untitled Story"}.epub`;
}

/** Triggers a browser download of the given blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Builds a minimal, valid EPUB 3 package in memory. `chapters` must already
 * be in reading order (story-data returns them ordered by position).
 */
export async function buildEpub(
  story: EpubStoryInput,
  storyId: string,
  chapters: Chapter[],
  cover: EpubCoverAsset | null,
): Promise<Blob> {
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );

  const isoLanguage = toIsoLanguage(story.language);
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const identifier = `novelsync-story-${storyId}`;

  const orderedChapters = [...chapters].sort((a, b) => a.order - b.order);
  const chapterFiles = orderedChapters.map((chapter, index) => {
    const num = String(index + 1).padStart(4, "0");
    return {
      chapter,
      id: `chap${num}`,
      href: `text/chapter-${num}.xhtml`,
    };
  });

  const hasCover = cover !== null;

  // --- content.opf ---
  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="css/stylesheet.css" media-type="text/css"/>`,
  ];
  const spineItems: string[] = [];

  if (hasCover) {
    manifestItems.push(
      `<item id="cover-img" href="images/cover.${cover.extension}" media-type="${cover.mediaType}" properties="cover-image"/>`,
      `<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="cover"/>`);
  }

  chapterFiles.forEach(({ id, href }) => {
    manifestItems.push(
      `<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`<itemref idref="${id}"/>`);
  });

  const subjectTags = (story.tags ?? [])
    .map((tag) => `<dc:subject>${escapeXml(tag)}</dc:subject>`)
    .join("\n    ");

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="pub-id" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(story.title || "Untitled Story")}</dc:title>
    <dc:creator>${escapeXml(story.author || "Unknown")}</dc:creator>
    <dc:language>${isoLanguage}</dc:language>
    ${story.description ? `<dc:description>${escapeXml(story.description)}</dc:description>` : ""}
    ${story.copyright ? `<dc:rights>${escapeXml(story.copyright)}</dc:rights>` : ""}
    ${subjectTags}
    <meta property="dcterms:modified">${modified}</meta>
    ${hasCover ? `<meta name="cover" content="cover-img"/>` : ""}
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    ${spineItems.join("\n    ")}
  </spine>
  ${hasCover ? `<guide>\n    <reference type="cover" title="Cover" href="text/cover.xhtml"/>\n  </guide>` : ""}
</package>
`;
  zip.file("OEBPS/content.opf", contentOpf);

  // --- nav.xhtml ---
  const navItems = chapterFiles
    .map(
      ({ chapter, href }) =>
        `<li><a href="${href}">${escapeXml(chapter.title || "Untitled Chapter")}</a></li>`,
    )
    .join("\n        ");

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title><link rel="stylesheet" href="css/stylesheet.css" type="text/css"/></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
        ${navItems}
    </ol>
  </nav>
</body>
</html>
`,
  );

  // --- stylesheet ---
  zip.file(
    "OEBPS/css/stylesheet.css",
    `body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 1.25em;
}
h1, h2, h3 {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.25;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
p {
  margin: 0 0 1em 0;
}
.cover {
  text-align: center;
  margin: 0;
  padding: 0;
}
.cover img {
  max-width: 100%;
  height: auto;
}
`,
  );

  // --- cover ---
  if (cover) {
    zip.file(`OEBPS/images/cover.${cover.extension}`, cover.bytes);
    zip.file(
      "OEBPS/text/cover.xhtml",
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Cover</title><link rel="stylesheet" href="../css/stylesheet.css" type="text/css"/></head>
<body epub:type="cover">
  <div class="cover"><img src="../images/cover.${cover.extension}" alt="Cover"/></div>
</body>
</html>
`,
    );
  }

  // --- chapters ---
  chapterFiles.forEach(({ chapter, href }) => {
    const title = escapeXml(chapter.title || "Untitled Chapter");
    const bodyContent = cleanChapterHtml(chapter.content);
    zip.file(
      `OEBPS/${href}`,
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${isoLanguage}">
<head><title>${title}</title><link rel="stylesheet" href="../css/stylesheet.css" type="text/css"/></head>
<body>
  <section epub:type="chapter">
    <h1>${title}</h1>
    ${bodyContent}
  </section>
</body>
</html>
`,
    );
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
}
