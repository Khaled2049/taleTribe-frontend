import { useState } from "react";
import { Link } from "react-router-dom";
import type { StoryMetadata } from "@novelsync/story-data-client";
import { usePublishedStories } from "@/hooks/queries/publishedStories";
import { genrePath, storyPath } from "@/lib/seoPaths";

const SHELF_GENRES = [
  { value: "all", name: "Everything" },
  { value: "fantasy", name: "Fantasy" },
  { value: "romance", name: "Romance" },
  { value: "mystery-thriller", name: "Mystery" },
  { value: "science-fiction", name: "Sci-fi" },
  { value: "horror", name: "Horror" },
];

const SHELF_SIZE = 10;
const PILE_SIZE = 5;

// How many spines fit beside the sign-up slot at each width, at the widest
// spine (4.3rem), so the shelf never overflows. Phones get the pile instead.
function fitClass(index: number): string {
  if (index < 4) return "";
  if (index < 6) return "hidden md:flex";
  if (index < 7) return "hidden lg:flex";
  return "hidden xl:flex";
}

const SPINE_COLORS = [
  "bg-ns-ink text-ns-bg",
  "bg-ns-accent text-ns-bg",
  "bg-ns-teal text-ns-bg",
  "bg-ns-gold text-ns-bg",
  "bg-ns-surface-hover text-ns-ink border border-ns-border-strong",
  "bg-ns-accent-deep text-ns-bg",
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function Spine({ story, index }: { story: StoryMetadata; index: number }) {
  const h = hash(story.id);
  return (
    <Link
      to={storyPath(story.id, story.title)}
      aria-label={`${story.title} by ${story.author}`}
      title={`${story.title} by ${story.author}`}
      className={`group flex shrink-0 flex-col items-center justify-between rounded-t-[3px] px-2 py-4 no-underline shadow-ns transition-transform duration-200 ease-out hover:-translate-y-4 focus-visible:-translate-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-bg motion-reduce:transition-none ${fitClass(index)} ${
        SPINE_COLORS[h % SPINE_COLORS.length]
      }`}
      style={{
        height: `${15 + (h % 5)}rem`,
        width: `${3.1 + ((h >> 3) % 4) * 0.4}rem`,
      }}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-heading text-lg font-semibold leading-none [writing-mode:vertical-rl]">
        {story.title}
      </span>
      <span className="mt-3 max-h-[5.5rem] overflow-hidden text-ellipsis whitespace-nowrap font-ui text-[0.68rem] opacity-75 [writing-mode:vertical-rl]">
        {story.author}
      </span>
    </Link>
  );
}

function FlatBook({ story }: { story: StoryMetadata }) {
  const h = hash(story.id);
  const thickness = 2.5 + Math.min(story.chapterCount, 12) * 0.1;
  return (
    <Link
      to={storyPath(story.id, story.title)}
      aria-label={`${story.title} by ${story.author}`}
      className={`relative flex items-center justify-between gap-3 rounded-[3px] px-7 no-underline shadow-[inset_6px_0_0_var(--ns-shadow-strong),inset_-6px_0_0_var(--ns-shadow-strong)] transition-transform duration-200 ease-out hover:translate-x-1.5 focus-visible:translate-x-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-bg motion-reduce:transition-none ${
        SPINE_COLORS[h % SPINE_COLORS.length]
      }`}
      style={{ height: `${thickness}rem`, width: `${76 + (h % 4) * 8}%` }}
    >
      <span
        className="absolute inset-y-1.5 left-4 w-[2px] bg-current opacity-25"
        aria-hidden="true"
      />
      <span className="truncate font-heading text-lg font-semibold leading-none">
        {story.title}
      </span>
      <span className="max-w-[40%] shrink-0 truncate font-ui text-xs opacity-75">
        {story.author}
      </span>
      <span
        className="absolute inset-y-1.5 right-4 w-[2px] bg-current opacity-25"
        aria-hidden="true"
      />
    </Link>
  );
}

export function StoryShelf() {
  const [genre, setGenre] = useState("all");
  const { data, isPending, isError } = usePublishedStories(genre);
  const stories = data?.pages[0]?.stories.slice(0, SHELF_SIZE) ?? [];
  const seeAll = genre === "all" ? "/stories" : genrePath(genre);
  const empty = !isPending && !isError && stories.length === 0;
  const slotText = empty
    ? "Nothing here yet. Write the first one."
    : "Your story goes here.";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Genre">
          {SHELF_GENRES.map((g) => (
            <button
              key={g.value}
              type="button"
              aria-pressed={genre === g.value}
              onClick={() => setGenre(g.value)}
              className={`rounded-full border px-4 py-1.5 font-ui text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${
                genre === g.value
                  ? "border-ns-ink bg-ns-ink text-ns-bg"
                  : "border-ns-border-strong text-ns-ink-secondary hover:border-ns-ink hover:text-ns-ink"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
        <Link
          to={seeAll}
          className="font-ui text-sm font-semibold text-ns-ink underline decoration-ns-border-strong underline-offset-[6px] transition-colors hover:text-ns-accent hover:decoration-ns-accent"
        >
          See all stories
        </Link>
      </div>

      <div className="relative mt-8 sm:hidden">
        <div className="flex flex-col items-start gap-0.5">
          <Link
            to="/sign-up"
            className="group mb-2 flex w-full items-center justify-between gap-3 rounded-[3px] border-2 border-dashed border-ns-accent bg-ns-accent-subtle p-4 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-bg"
          >
            <span className="font-heading text-xl font-medium leading-tight text-ns-ink">
              {slotText}
            </span>
            <span className="shrink-0 rounded-full bg-ns-accent px-4 py-2.5 font-ui text-sm font-semibold text-[var(--ns-bg)] transition-colors group-hover:bg-ns-accent-hover">
              Start writing free
            </span>
          </Link>

          {isPending &&
            Array.from({ length: PILE_SIZE }, (_, i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-[3px] bg-ns-surface-hover"
                aria-hidden="true"
              />
            ))}

          {!isPending &&
            stories
              .slice(0, PILE_SIZE)
              .map((story) => <FlatBook key={story.id} story={story} />)}
        </div>
        <div
          className="mt-1 h-3 rounded-sm bg-ns-border-strong shadow-[0_6px_12px_-6px_var(--ns-shadow-strong)]"
          aria-hidden="true"
        />
      </div>

      <div className="relative mt-8 hidden sm:block">
        <div className="flex min-h-[20rem] items-end gap-1.5 overflow-hidden px-1 pt-6">
          <Link
            to="/sign-up"
            className="group mr-3 flex h-[17rem] w-[11rem] shrink-0 flex-col justify-between rounded-t-[3px] border-2 border-dashed border-ns-accent bg-ns-accent-subtle p-4 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-bg"
          >
            <span className="font-heading text-2xl font-medium leading-tight text-ns-ink">
              {slotText}
            </span>
            <span className="inline-flex items-center justify-center rounded-full bg-ns-accent px-4 py-2.5 font-ui text-sm font-semibold text-[var(--ns-bg)] transition-colors group-hover:bg-ns-accent-hover">
              Start writing free
            </span>
          </Link>

          {isPending &&
            Array.from({ length: SHELF_SIZE }, (_, i) => (
              <div
                key={i}
                className={`shrink-0 animate-pulse rounded-t-[3px] bg-ns-surface-hover ${fitClass(i)}`}
                style={{ height: `${15 + (i % 4)}rem`, width: "3.4rem" }}
                aria-hidden="true"
              />
            ))}

          {!isPending &&
            stories.map((story, i) => (
              <Spine key={story.id} story={story} index={i} />
            ))}

          {!isPending && (stories.length > 0 || isError) && (
            <Link
              to={seeAll}
              className="ml-3 hidden h-[15rem] w-[9rem] lg:flex shrink-0 flex-col justify-end rounded-t-[3px] border-2 border-dashed border-ns-border-strong p-4 font-heading text-xl font-medium leading-tight text-ns-ink no-underline transition-colors hover:border-ns-accent hover:text-ns-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              {stories.length ? "Browse the whole library" : "Browse stories"}
            </Link>
          )}
        </div>
        <div
          className="h-3 rounded-sm bg-ns-border-strong shadow-[0_6px_12px_-6px_var(--ns-shadow-strong)]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
