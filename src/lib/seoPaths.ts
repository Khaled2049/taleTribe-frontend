/**
 * Public URL shapes. KEEP IN SYNC with functions/src/seo/paths.ts: the
 * seoRender Function 301s any story URL that is not the canonical one, so a
 * link built differently here costs every reader a redirect. Both sides assert
 * the same vectors (tests/seoPaths.test.ts, functions/tests/seo.test.ts).
 */

const UUID_AT_END =
  /(?:^|-)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const COMBINING_MARKS = /[̀-ͯ]/g;
const MAX_SLUG_LENGTH = 60;

export const GENRES = [
  { value: "fiction", name: "Fiction" },
  { value: "non-fiction", name: "Non-Fiction" },
  { value: "poetry", name: "Poetry" },
  { value: "fantasy", name: "Fantasy" },
  { value: "science-fiction", name: "Science Fiction" },
  { value: "romance", name: "Romance" },
  { value: "mystery-thriller", name: "Mystery & Thriller" },
  { value: "horror", name: "Horror" },
  { value: "historical-fiction", name: "Historical Fiction" },
  { value: "young-adult", name: "Young Adult" },
] as const;

export const genreName = (value: string | undefined): string | undefined =>
  GENRES.find((genre) => genre.value === value)?.name;

/** ASCII slug; a title with no Latin letters or digits yields "". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/** Without a title the bare id still resolves; the server redirects it. */
export function storyPath(id: string, title = ""): string {
  const slug = slugify(title);
  return `/story/${slug ? `${slug}-` : ""}${id}`;
}

export const chapterPath = (
  id: string,
  title: string,
  chapterId: string,
): string => `${storyPath(id, title)}/read/${chapterId}`;

/** The story id is the trailing UUID, so a stale or missing slug still resolves. */
export function storyIdFromParam(
  param: string | undefined,
): string | undefined {
  const match = UUID_AT_END.exec(param ?? "");
  return match ? match[1].toLowerCase() : undefined;
}

export const profilePath = (userId: string): string =>
  `/profile/${encodeURIComponent(userId)}`;

export const genrePath = (genre: string): string =>
  genre === "all" ? "/stories" : `/stories/genre/${encodeURIComponent(genre)}`;

/** Mirrors store.TagSlug in story-data, which is what the tag filter matches. */
export const tagSlug = (tag: string): string =>
  tag.trim().toLowerCase().replace(/ /g, "-");

export const tagPath = (tag: string): string =>
  `/stories/tag/${encodeURIComponent(tagSlug(tag))}`;
