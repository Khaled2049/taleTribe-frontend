import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { htmlToParagraphs, renderDocument, truncate, type Page } from "../src/seo/html";
import { resolvePage } from "../src/seo/pages";
import { slugify, storyIdFromParam, storyPath, tagPath } from "../src/seo/paths";
import { renderSitemap, resetSitemapCache } from "../src/seo/sitemap";

const STORY_ID = "3f2b8c1e-9d4a-4b6f-8e21-0a1b2c3d4e5f";
const CHAPTER_ID = "11111111-2222-4333-8444-555555555555";

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Default</title>
    <meta
      name="description"
      content="Default description"
      data-rh="true"
    />
    <meta property="og:title" content="Default" data-rh="true" />
    <link rel="icon" href="/book.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

const story = (overrides: Record<string, unknown> = {}) => ({
  id: STORY_ID,
  authorId: "author-uid",
  title: "The Glass Cartographer",
  description: "A mapmaker charts a city that rearranges itself.",
  authorName: "mira",
  category: "fantasy",
  language: "en",
  coverImageUrl: "https://cdn.example/cover.jpg",
  tags: ["Dark Fantasy"],
  chapterCount: 1,
  views: 10,
  likeCount: 2,
  averageRating: 4.5,
  ratingsCount: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
  ...overrides,
});

const chapterMeta = { id: CHAPTER_ID, title: "One", position: 1, wordCount: 3, updatedAt: "2026-02-01T00:00:00Z" };

/** Routes fetch by URL substring; an unmatched URL is a 404, as story-data would answer. */
function stubFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(routes).find((candidate) => url.includes(candidate));
    if (!key) return new Response("{}", { status: 404 });
    const value = routes[key];
    if (typeof value === "number") return new Response("{}", { status: value });
    return new Response(JSON.stringify(value), { status: 200 });
  }) as typeof fetch;
  return calls;
}

const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.SITE_URL = "https://example.test";
  process.env.STORY_DATA_URL = "https://api.example.test";
  resetSitemapCache();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("paths", () => {
  // The same vectors are asserted in tests/seoPaths.test.ts in the web app.
  it("slugifies titles", () => {
    assert.equal(slugify("The Glass Cartographer"), "the-glass-cartographer");
    assert.equal(slugify("  Café — au lait!  "), "cafe-au-lait");
    assert.equal(slugify("夜の物語"), "");
    assert.equal(slugify("a".repeat(70) + " b"), "a".repeat(60));
  });

  it("builds and parses story paths", () => {
    assert.equal(storyPath(STORY_ID, "The Glass Cartographer"), `/story/the-glass-cartographer-${STORY_ID}`);
    assert.equal(storyPath(STORY_ID, "夜の物語"), `/story/${STORY_ID}`);
    assert.equal(storyIdFromParam(`the-glass-cartographer-${STORY_ID}`), STORY_ID);
    assert.equal(storyIdFromParam(STORY_ID.toUpperCase()), STORY_ID);
    assert.equal(storyIdFromParam("the-glass-cartographer"), null);
    assert.equal(storyIdFromParam(`x${STORY_ID}`), null);
  });

  it("builds tag paths", () => {
    assert.equal(tagPath("Dark Fantasy"), "/stories/tag/dark-fantasy");
    assert.equal(tagPath("c++"), "/stories/tag/c%2B%2B");
  });
});

describe("html", () => {
  const page: Page = {
    status: 200,
    title: "A <b>title</b> & $& more",
    description: "Says \"hi\"",
    canonical: "https://example.test/story/x",
    index: true,
    ogType: "book",
    image: "https://example.test/og-default.png",
    largeImage: true,
    jsonLd: [{ name: "</script><script>alert(1)</script>" }],
    snapshot: "<h1>Snapshot</h1>",
  };

  it("replaces the shell's default tags instead of adding beside them", () => {
    const html = renderDocument(TEMPLATE, page) as string;
    assert.equal(html.match(/<title>/g)?.length, 1);
    assert.equal(html.match(/name="description"/g)?.length, 1);
    assert.ok(!html.includes("Default description"));
    assert.ok(html.includes("<title>A &lt;b&gt;title&lt;/b&gt; &amp; $&amp; more</title>"));
    assert.ok(html.includes("content=\"Says &quot;hi&quot;\""));
    assert.ok(html.includes("<link rel=\"canonical\" href=\"https://example.test/story/x\" data-rh=\"true\" />"));
    assert.ok(html.includes("<div id=\"root\"><h1>Snapshot</h1></div>"));
    // Untouched: the icon, and the script that boots the app.
    assert.ok(html.includes("<link rel=\"icon\" href=\"/book.svg\" />"));
    assert.ok(html.includes("/assets/index-abc.js"));
  });

  it("cannot be broken out of through JSON-LD", () => {
    const html = renderDocument(TEMPLATE, page) as string;
    assert.ok(!html.includes("</script><script>alert(1)"));
    assert.ok(html.includes("\\u003c/script>"));
  });

  it("marks a non-indexable page and refuses an unfamiliar shell", () => {
    const html = renderDocument(TEMPLATE, { ...page, index: false, canonical: undefined }) as string;
    assert.ok(html.includes("content=\"noindex, follow\""));
    assert.ok(!html.includes("rel=\"canonical\""));
    assert.equal(renderDocument("<html><body>maintenance</body></html>", page), null);
  });

  it("reduces chapter markup to escaped-later plain paragraphs", () => {
    const paragraphs = htmlToParagraphs(
      "<h2>Dawn</h2><p>She said &quot;go&quot; &amp; left.<br>Then&nbsp;rain.</p><script>alert(1)</script><p><img src=x onerror=alert(1)>&#x41;</p>",
      1000,
    );
    assert.deepEqual(paragraphs, ["Dawn", "She said \"go\" & left.", "Then rain.", "A"]);
    assert.equal(htmlToParagraphs(`<p>${"word ".repeat(100)}</p><p>${"more ".repeat(100)}</p>`, 600).length, 1);
  });

  it("truncates on a word boundary", () => {
    assert.equal(truncate("short", 160), "short");
    const cut = truncate("one two three four five six seven eight nine ten", 30);
    assert.ok(cut.length <= 30 && cut.endsWith("…") && !cut.includes("  "));
  });
});

describe("resolvePage", () => {
  const noQuery = new URLSearchParams();
  const canonical = `/story/the-glass-cartographer-${STORY_ID}`;

  it("leaves non-public routes to the plain shell without calling story-data", async () => {
    const calls = stubFetch({});
    assert.equal(await resolvePage("/create/abc", noQuery), null);
    assert.equal(await resolvePage("/", noQuery), null);
    assert.equal(calls.length, 0);
  });

  it("redirects a bare or stale-slug story URL to the canonical one", async () => {
    stubFetch({ [`/v1/public/stories/${STORY_ID}`]: { story: story(), chapters: [chapterMeta] } });
    assert.deepEqual(await resolvePage(`/story/${STORY_ID}`, noQuery), { kind: "redirect", location: canonical });
    assert.deepEqual(await resolvePage(`/story/old-title-${STORY_ID}/read/${CHAPTER_ID}`, noQuery), {
      kind: "redirect",
      location: `${canonical}/read/${CHAPTER_ID}`,
    });
  });

  it("describes a published story", async () => {
    stubFetch({ [`/v1/public/stories/${STORY_ID}`]: { story: story(), chapters: [chapterMeta] } });
    const resolution = await resolvePage(canonical, noQuery);
    assert.equal(resolution?.kind, "page");
    const page = (resolution as { page: Page }).page;
    assert.equal(page.status, 200);
    assert.equal(page.index, true);
    assert.equal(page.title, "The Glass Cartographer by mira | TheTaleTribe");
    assert.equal(page.canonical, `https://example.test${canonical}`);
    assert.equal(page.image, "https://cdn.example/cover.jpg");
    assert.equal(page.largeImage, false);
    assert.deepEqual(page.preload, [`https://api.example.test/v1/public/stories/${STORY_ID}`]);
    const book = page.jsonLd[0] as Record<string, any>;
    assert.equal(book["@type"], "Book");
    assert.equal(book.aggregateRating.ratingCount, 2);
    assert.equal(book.hasPart[0].url, `https://example.test${canonical}/read/${CHAPTER_ID}`);
    assert.ok(page.snapshot.includes(`href="${canonical}/read/${CHAPTER_ID}"`));
    assert.ok(page.snapshot.includes("href=\"/stories/tag/dark-fantasy\""));
    assert.ok(page.snapshot.includes("href=\"/profile/author-uid\""));
  });

  it("omits aggregateRating when nobody has rated", async () => {
    stubFetch({
      [`/v1/public/stories/${STORY_ID}`]: {
        story: story({ averageRating: undefined, ratingsCount: 0 }),
        chapters: [],
      },
    });
    const page = ((await resolvePage(canonical, noQuery)) as { page: Page }).page;
    assert.equal((page.jsonLd[0] as Record<string, unknown>).aggregateRating, undefined);
  });

  it("escapes author-controlled text in the snapshot", async () => {
    const title = "<img src=x onerror=alert(1)>";
    stubFetch({ [`/v1/public/stories/${STORY_ID}`]: { story: story({ title, description: "<script>x</script>" }), chapters: [] } });
    const page = ((await resolvePage(storyPath(STORY_ID, title), noQuery)) as { page: Page }).page;
    assert.ok(!page.snapshot.includes("<img"));
    assert.ok(!page.snapshot.includes("<script>"));
  });

  it("renders chapter prose and answers 404 for a chapter of another story", async () => {
    stubFetch({
      [`/chapters/${CHAPTER_ID}`]: { ...chapterMeta, content: "<h2>I</h2><p>It began at dawn.</p>" },
      [`/v1/public/stories/${STORY_ID}`]: { story: story(), chapters: [chapterMeta] },
    });
    const page = ((await resolvePage(`${canonical}/read/${CHAPTER_ID}`, noQuery)) as { page: Page }).page;
    assert.equal(page.title, "One — The Glass Cartographer | TheTaleTribe");
    assert.equal(page.description, "I It began at dawn.");
    assert.ok(page.snapshot.includes("<p>It began at dawn.</p>"));
    assert.equal((page.jsonLd[0] as Record<string, unknown>)["@type"], "Chapter");

    const other = (await resolvePage(`${canonical}/read/99999999-2222-4333-8444-555555555555`, noQuery)) as { page: Page };
    assert.equal(other.page.status, 404);
  });

  it("answers 404, not a soft 404, for a missing or malformed story", async () => {
    stubFetch({});
    for (const path of [`/story/${STORY_ID}`, "/story/not-a-story", "/stories/genre/nonsense", "/stories/a/b/c"]) {
      const page = ((await resolvePage(path, noQuery)) as { page: Page }).page;
      assert.equal(page.status, 404, path);
      assert.equal(page.index, false, path);
    }
  });

  it("propagates an outage so the caller can fall back to the plain shell", async () => {
    stubFetch({ [`/v1/public/stories/${STORY_ID}`]: 503 });
    await assert.rejects(resolvePage(canonical, noQuery));
  });

  it("indexes a profile only once its owner has published", async () => {
    const profile = { userId: "author-uid", username: "mira", createdAt: "", updatedAt: "", followerCount: 3 };
    stubFetch({
      "/v1/public/profiles/author-uid": { ...profile, isWriter: true },
      "author=author-uid": { stories: [story()] },
    });
    const writer = ((await resolvePage("/profile/author-uid", noQuery)) as { page: Page }).page;
    assert.equal(writer.index, true);
    assert.equal((writer.jsonLd[0] as Record<string, unknown>)["@type"], "ProfilePage");
    assert.ok(writer.snapshot.includes(canonical));

    const calls = stubFetch({ "/v1/public/profiles/reader-uid": { ...profile, userId: "reader-uid", isWriter: false } });
    const reader = ((await resolvePage("/profile/reader-uid", noQuery)) as { page: Page }).page;
    assert.equal(reader.index, false);
    assert.equal(calls.length, 1);
  });

  it("keeps search results and thin tag pages out of the index", async () => {
    const calls = stubFetch({ "tag=dark-fantasy": { stories: [story()] }, "/v1/public/stories?": { stories: [story()] } });
    const search = ((await resolvePage("/stories", new URLSearchParams("q=dragon"))) as { page: Page }).page;
    assert.equal(search.index, false);
    assert.equal(search.canonical, "https://example.test/stories");
    assert.equal(calls.length, 0);

    const all = ((await resolvePage("/stories", noQuery)) as { page: Page }).page;
    assert.equal(all.index, true);

    const thin = ((await resolvePage("/stories/tag/dark-fantasy", noQuery)) as { page: Page }).page;
    assert.equal(thin.index, false);
    assert.deepEqual(await resolvePage("/stories/tag/Dark Fantasy", noQuery), {
      kind: "redirect",
      location: "/stories/tag/dark-fantasy",
    });
  });
});

describe("sitemap", () => {
  it("indexes its children and lists stories and their authors", async () => {
    stubFetch({
      "cursor=next": { stories: [{ id: CHAPTER_ID, authorId: "author-uid", title: "Older & Wiser", updatedAt: "2026-01-01T00:00:00Z" }] },
      "/v1/public/sitemap": {
        stories: [{ id: STORY_ID, authorId: "author-uid", title: "The Glass Cartographer", updatedAt: "2026-02-01T00:00:00Z" }],
        nextCursor: "next",
      },
    });
    const index = (await renderSitemap("/sitemap.xml")) as string;
    assert.ok(index.includes("<loc>https://example.test/sitemaps/stories.xml</loc>"));

    const stories = (await renderSitemap("/sitemaps/stories.xml")) as string;
    assert.ok(stories.includes(`<loc>https://example.test/story/the-glass-cartographer-${STORY_ID}</loc><lastmod>2026-02-01T00:00:00Z</lastmod>`));
    assert.ok(stories.includes(`/story/older-wiser-${CHAPTER_ID}`));

    const authors = (await renderSitemap("/sitemaps/authors.xml")) as string;
    assert.equal(authors.match(/<url>/g)?.length, 1);
    assert.ok(authors.includes("<lastmod>2026-02-01T00:00:00Z</lastmod>"));

    assert.ok(((await renderSitemap("/sitemaps/pages.xml")) as string).includes("/stories/genre/fantasy"));
    assert.equal(await renderSitemap("/sitemaps/other.xml"), null);
  });

  it("fails rather than publishing an empty sitemap during an outage", async () => {
    stubFetch({ "/v1/public/sitemap": 503 });
    await assert.rejects(renderSitemap("/sitemaps/stories.xml"));
    // The failure is not cached.
    stubFetch({ "/v1/public/sitemap": { stories: [] } });
    assert.ok(((await renderSitemap("/sitemaps/stories.xml")) as string).includes("<urlset"));
  });
});
