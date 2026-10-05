/**
 * Maps a public URL to what a crawler should be told about it. Only routes
 * whose content is public and worth indexing are resolved; everything else
 * returns null and is served as the untouched SPA shell.
 */
import { escapeHtml, htmlToParagraphs, truncate, type Page } from "./html";
import {
  GENRES,
  chapterPath,
  genreName,
  genrePath,
  profilePath,
  storyIdFromParam,
  storyPath,
  tagPath,
  tagSlug,
} from "./paths";
import * as schema from "./schema";
import { DEFAULT_IMAGE_PATH, absoluteUrl, siteName, storyDataUrl } from "./site";
import {
  getChapter,
  getProfile,
  getStory,
  isNotFound,
  listStories,
  type PublicStory,
} from "./storyData";

export type Resolution =
  | { kind: "page"; page: Page }
  | { kind: "redirect"; location: string }
  | null;

const DESCRIPTION_LENGTH = 160;
const LISTING_PAGE_SIZE = 24;
// A tag page with a story or two is a near-duplicate of those stories' pages.
const MIN_STORIES_TO_INDEX_TAG = 3;
// Enough for a crawler to index the chapter without shipping a 500k-char body twice.
const CHAPTER_SNAPSHOT_CHARS = 20000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const titled = (title: string) => `${title} | ${siteName()}`;
const link = (path: string, text: string) => `<a href="${escapeHtml(path)}">${escapeHtml(text)}</a>`;

/** Inline styles only: the app's stylesheet has not loaded when this paints. */
function snapshot(crumbs: schema.Crumb[], body: string): string {
  const trail = crumbs
    .map((crumb, index) => (index === crumbs.length - 1 ? escapeHtml(crumb.name) : link(crumb.path, crumb.name)))
    .join(" › ");
  return (
    "<div data-seo-snapshot style=\"max-width:42rem;margin:0 auto;padding:6rem 1.5rem 3rem;line-height:1.6\">" +
    `<nav aria-label="Breadcrumb" style="font-size:.8rem">${trail}</nav>${body}</div>`
  );
}

function storyList(stories: PublicStory[]): string {
  if (stories.length === 0) return "";
  const items = stories.map((story) =>
    `<li>${link(storyPath(story.id, story.title), story.title)} by ${link(profilePath(story.authorId), story.authorName)}` +
    `${story.description ? ` — ${escapeHtml(truncate(story.description, 140))}` : ""}</li>`);
  return `<ul>${items.join("")}</ul>`;
}

function basePage(overrides: Partial<Page> & Pick<Page, "title" | "description">): Page {
  return {
    status: 200,
    index: true,
    ogType: "website",
    image: absoluteUrl(DEFAULT_IMAGE_PATH),
    largeImage: true,
    jsonLd: [],
    snapshot: "",
    ...overrides,
  };
}

/** A real 404 status: the shell alone would be a soft 404 that Google keeps recrawling. */
const notFoundPage = (what: string): Resolution => ({
  kind: "page",
  page: basePage({
    status: 404,
    index: false,
    title: titled(`${what} not found`),
    description: `This ${what.toLowerCase()} is not available on ${siteName()}.`,
  }),
});

const storyCrumbs = (story: PublicStory): schema.Crumb[] => [
  { name: "Home", path: "/" },
  { name: "Stories", path: "/stories" },
  ...(genreName(story.category) ? [{ name: genreName(story.category) as string, path: genrePath(story.category) }] : []),
  { name: story.title, path: storyPath(story.id, story.title) },
];

async function storyPage(param: string, rest: string[]): Promise<Resolution> {
  const storyId = storyIdFromParam(param);
  if (!storyId) return notFoundPage("Story");

  const chapterId = rest[0] === "read" ? rest[1] : undefined;
  if (rest.length > 0 && (rest[0] !== "read" || rest.length > 2)) return notFoundPage("Page");
  if (chapterId !== undefined && !UUID.test(chapterId)) return notFoundPage("Chapter");

  let detail;
  try {
    detail = await getStory(storyId);
  } catch (error) {
    if (isNotFound(error)) return notFoundPage("Story");
    throw error;
  }
  const { story, chapters } = detail;
  const path = storyPath(story.id, story.title);
  const suffix = rest.length > 0 ? `/${rest.join("/")}` : "";
  if (`/story/${param}` !== path) return { kind: "redirect", location: `${path}${suffix}` };

  const crumbs = storyCrumbs(story);
  const image = absoluteUrl(story.coverImageUrl || DEFAULT_IMAGE_PATH);
  const byline = `by ${link(profilePath(story.authorId), story.authorName)}`;
  // Must equal the URL the app's publicStoryRepo requests or the preload is wasted.
  const storyApi = storyDataUrl().startsWith("https://")
    ? [`${storyDataUrl()}/v1/public/stories/${story.id}`]
    : undefined;

  if (rest[0] === "read" && !chapterId) {
    // The app picks the reader's resume chapter here; there is nothing to index.
    return {
      kind: "page",
      page: basePage({
        index: false,
        title: titled(story.title),
        description: truncate(story.description || story.title, DESCRIPTION_LENGTH),
        canonical: absoluteUrl(path),
        preload: storyApi,
      }),
    };
  }

  if (chapterId) {
    const position = chapters.findIndex((item) => item.id.toLowerCase() === chapterId.toLowerCase());
    if (position < 0) return notFoundPage("Chapter");
    let chapter;
    try {
      chapter = await getChapter(story.id, chapters[position].id);
    } catch (error) {
      if (isNotFound(error)) return notFoundPage("Chapter");
      throw error;
    }
    const selfPath = chapterPath(story.id, story.title, chapter.id);
    const paragraphs = htmlToParagraphs(chapter.content ?? "", CHAPTER_SNAPSHOT_CHARS);
    const previous = chapters[position - 1];
    const next = chapters[position + 1];
    const pager = [
      previous && link(chapterPath(story.id, story.title, previous.id), `← ${previous.title}`),
      link(path, "All chapters"),
      next && link(chapterPath(story.id, story.title, next.id), `${next.title} →`),
    ].filter(Boolean).join(" · ");
    const chapterCrumbs = [...crumbs, { name: chapter.title, path: selfPath }];
    return {
      kind: "page",
      page: basePage({
        title: titled(`${chapter.title} — ${story.title}`),
        // Joined, not paragraphs[0]: a chapter often opens on a one-word heading.
        description: truncate(
          paragraphs.slice(0, 5).join(" ") || `Read ${chapter.title} of ${story.title} by ${story.authorName}.`,
          DESCRIPTION_LENGTH,
        ),
        canonical: absoluteUrl(selfPath),
        ogType: "article",
        image,
        largeImage: !story.coverImageUrl,
        jsonLd: [schema.chapter(story, chapter, position + 1), schema.breadcrumbs(chapterCrumbs)],
        snapshot: snapshot(
          chapterCrumbs,
          `<article><h1>${escapeHtml(chapter.title)}</h1><p>${link(path, story.title)} ${byline}</p>` +
            `${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</article>` +
            `<nav aria-label="Chapters">${pager}</nav>`,
        ),
        preload: storyApi,
      }),
    };
  }

  const chapterLinks = chapters.map((item) =>
    `<li>${link(chapterPath(story.id, story.title, item.id), item.title)}</li>`).join("");
  const tagLinks = story.tags.map((tag) => link(tagPath(tag), tag)).join(", ");
  const description = story.description ||
    `Read ${story.title} by ${story.authorName} on ${siteName()}.`;
  return {
    kind: "page",
    page: basePage({
      title: titled(`${story.title} by ${story.authorName}`),
      description: truncate(description, DESCRIPTION_LENGTH),
      canonical: absoluteUrl(path),
      ogType: "book",
      image,
      largeImage: !story.coverImageUrl,
      jsonLd: [schema.book(story, chapters, image), schema.breadcrumbs(crumbs)],
      snapshot: snapshot(
        crumbs,
        `<article><h1>${escapeHtml(story.title)}</h1><p>${byline}</p>` +
          `${story.description ? `<p>${escapeHtml(story.description)}</p>` : ""}` +
          `${chapterLinks ? `<h2>Chapters</h2><ol>${chapterLinks}</ol>` : ""}` +
          `${tagLinks ? `<p>Tags: ${tagLinks}</p>` : ""}</article>`,
      ),
      preload: storyApi,
    }),
  };
}

async function profilePageFor(userId: string): Promise<Resolution> {
  let profile;
  try {
    profile = await getProfile(userId);
  } catch (error) {
    if (isNotFound(error)) return notFoundPage("Profile");
    throw error;
  }
  const path = profilePath(profile.userId);
  const stories = profile.isWriter ? await listStories({ author: profile.userId }) : [];
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const heading = fullName ? `${fullName} (@${profile.username})` : `@${profile.username}`;
  const crumbs = [{ name: "Home", path: "/" }, { name: `@${profile.username}`, path }];
  const description = profile.bio ||
    `Read stories by @${profile.username} on ${siteName()}.`;
  return {
    kind: "page",
    page: basePage({
      // A member who has published nothing has no content here worth a result.
      index: stories.length > 0,
      title: titled(`${heading} — Stories`),
      description: truncate(description, DESCRIPTION_LENGTH),
      canonical: absoluteUrl(path),
      ogType: "profile",
      image: absoluteUrl(profile.photoUrl || DEFAULT_IMAGE_PATH),
      largeImage: !profile.photoUrl,
      jsonLd: [
        schema.profilePage(profile, stories.length < LISTING_PAGE_SIZE ? stories.length : undefined),
        schema.breadcrumbs(crumbs),
      ],
      snapshot: snapshot(
        crumbs,
        `<article><h1>${escapeHtml(heading)}</h1>` +
          `${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ""}` +
          `${profile.writingInterests ? `<p>Writes about ${escapeHtml(profile.writingInterests)}</p>` : ""}` +
          `${stories.length > 0 ? `<h2>Published stories</h2>${storyList(stories)}` : ""}</article>`,
      ),
    }),
  };
}

const genreNav = () =>
  `<nav aria-label="Genres">${GENRES.map((genre) => link(genrePath(genre.value), genre.name)).join(" · ")}</nav>`;

function listingPage(opts: {
  heading: string;
  description: string;
  path: string;
  crumbs: schema.Crumb[];
  stories: PublicStory[];
  index: boolean;
}): Resolution {
  return {
    kind: "page",
    page: basePage({
      index: opts.index,
      title: titled(opts.heading),
      description: opts.description,
      canonical: absoluteUrl(opts.path),
      jsonLd: [
        schema.collectionPage(opts.heading, opts.description, opts.path, opts.stories),
        schema.breadcrumbs(opts.crumbs),
      ],
      snapshot: snapshot(
        opts.crumbs,
        `<h1>${escapeHtml(opts.heading)}</h1><p>${escapeHtml(opts.description)}</p>${genreNav()}${storyList(opts.stories)}`,
      ),
    }),
  };
}

const STORIES_CRUMBS: schema.Crumb[] = [{ name: "Home", path: "/" }, { name: "Stories", path: "/stories" }];

async function storiesPage(segments: string[], hasSearch: boolean): Promise<Resolution> {
  if (segments.length === 0) {
    const description =
      `Browse original fiction from independent writers on ${siteName()} — fantasy, romance, science fiction, mystery, horror and more, free to read.`;
    // Search results are a filter over this page, not a page of their own.
    const stories = hasSearch ? [] : await listStories({});
    return listingPage({
      heading: "Discover Stories",
      description,
      path: "/stories",
      crumbs: STORIES_CRUMBS,
      stories,
      index: !hasSearch,
    });
  }
  if (segments.length !== 2) return notFoundPage("Page");
  const [kind, raw] = segments;

  if (kind === "genre") {
    const name = genreName(raw);
    if (!name) return notFoundPage("Genre");
    const path = genrePath(raw);
    return listingPage({
      heading: `${name} Stories`,
      description: `Read ${name.toLowerCase()} stories by independent writers on ${siteName()}. New chapters and new voices, free to read online.`,
      path,
      crumbs: [...STORIES_CRUMBS, { name, path }],
      stories: await listStories({ category: raw }),
      index: true,
    });
  }

  if (kind === "tag") {
    const tag = tagSlug(raw);
    if (!tag) return notFoundPage("Tag");
    const path = tagPath(tag);
    if (raw !== tag) return { kind: "redirect", location: path };
    const stories = await listStories({ tag });
    if (stories.length === 0) return notFoundPage("Tag");
    const label = tag.replace(/-/g, " ");
    return listingPage({
      heading: `Stories tagged “${label}”`,
      description: `Stories tagged ${label} on ${siteName()}, written by independent authors and free to read online.`,
      path,
      crumbs: [...STORIES_CRUMBS, { name: label, path }],
      stories,
      index: stories.length >= MIN_STORIES_TO_INDEX_TAG,
    });
  }
  return notFoundPage("Page");
}

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export async function resolvePage(pathname: string, query: URLSearchParams): Promise<Resolution> {
  const segments: string[] = [];
  for (const raw of pathname.split("/").filter(Boolean)) {
    const segment = decode(raw);
    if (segment === null) return notFoundPage("Page");
    segments.push(segment);
  }
  const [root, ...rest] = segments;
  if (root === "story" && rest.length > 0) return storyPage(rest[0], rest.slice(1));
  if (root === "profile" && rest.length === 1) return profilePageFor(rest[0]);
  if (root === "stories") return storiesPage(rest, query.has("q"));
  return null;
}
