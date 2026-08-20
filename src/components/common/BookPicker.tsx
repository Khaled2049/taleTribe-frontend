import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { IBookOfTheMonth } from "@/types/IClub";
import { StoryMetadata } from "@novelsync/story-data-client";
import { usePublishedStories } from "@/hooks/queries/useStoryQueries";
import { googleBookToBook, storyToBook } from "@/utils/bookMapping";
import BookSearch from "@/components/common/BookSearch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BookPickerProps {
  onSelect: (book: IBookOfTheMonth) => void;
  selected?: IBookOfTheMonth | null;
  autoFocus?: boolean;
}

const BookThumb = ({
  thumbnail,
  title,
  className = "w-10 h-14",
}: {
  thumbnail?: string;
  title: string;
  className?: string;
}) =>
  thumbnail ? (
    <img
      src={thumbnail}
      alt={`${title} cover`}
      className={`${className} object-cover rounded-ns shadow-ns-sm shrink-0`}
    />
  ) : (
    <div
      className={`${className} shrink-0 rounded-ns bg-ns-surface border border-ns-border flex items-center justify-center`}
      aria-hidden="true"
    >
      <span className="font-heading text-lg text-ns-ink-muted">
        {title.charAt(0).toUpperCase()}
      </span>
    </div>
  );

const StoryRow = ({
  story,
  onPick,
}: {
  story: StoryMetadata;
  onPick: (story: StoryMetadata) => void;
}) => (
  <button
    type="button"
    onClick={() => onPick(story)}
    className="w-full flex items-center gap-3 py-2.5 px-1 text-left border-b border-ns-border last:border-b-0 hover:bg-ns-surface-hover transition-colors group"
  >
    <BookThumb
      thumbnail={story.thumbnailUrl || story.coverImageUrl}
      title={story.title}
    />
    <div className="flex-1 min-w-0">
      <p className="font-heading text-base text-ns-ink truncate group-hover:text-ns-accent transition-colors">
        {story.title}
      </p>
      <p className="font-ui text-xs text-ns-ink-muted truncate">
        by {story.author}
      </p>
    </div>
    <span className="shrink-0 font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted border border-ns-border rounded-full px-2 py-0.5">
      {story.chapterCount} ch
    </span>
  </button>
);

/**
 * Tabbed book picker: published NovelSync stories or Google Books.
 * Emits a normalized IBookOfTheMonth either way.
 */
export const BookPicker = ({ onSelect, selected, autoFocus }: BookPickerProps) => {
  const [storyQuery, setStoryQuery] = useState("");
  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublishedStories("all");

  const stories = useMemo(
    () => data?.pages.flatMap((page) => page.stories) ?? [],
    [data],
  );

  const filteredStories = useMemo(() => {
    const q = storyQuery.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.author.toLowerCase().includes(q),
    );
  }, [stories, storyQuery]);

  return (
    <div>
      {selected && (
        <div className="mb-4 flex items-center gap-3 border-l-2 border-ns-accent pl-3 py-1">
          <BookThumb
            thumbnail={selected.volumeInfo.imageLinks?.thumbnail}
            title={selected.volumeInfo.title}
            className="w-9 h-12"
          />
          <div className="flex-1 min-w-0">
            <p className="font-heading text-base text-ns-ink truncate">
              {selected.volumeInfo.title}
            </p>
            <p className="font-ui text-xs text-ns-ink-muted truncate">
              {selected.volumeInfo.authors?.join(", ") || "Unknown author"}
              {selected.source === "novelsync" && " · on NovelSync"}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="novelsync">
        <TabsList className="w-full">
          <TabsTrigger value="novelsync" className="flex-1">
            On NovelSync
          </TabsTrigger>
          <TabsTrigger value="google" className="flex-1">
            Google Books
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novelsync">
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ns-ink-muted"
            />
            <input
              type="text"
              value={storyQuery}
              onChange={(e) => setStoryQuery(e.target.value)}
              placeholder="Filter by title or author…"
              autoFocus={autoFocus}
              className="w-full pl-8 pr-3 py-2 font-ui text-sm bg-transparent border-0 border-b border-ns-border text-ns-ink placeholder:text-ns-ink-muted focus:outline-none focus:border-ns-accent transition-colors"
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {isPending ? (
              <p className="py-6 text-center font-body italic text-sm text-ns-ink-muted">
                Loading published stories…
              </p>
            ) : isError ? (
              <p className="py-6 text-center font-body italic text-sm text-ns-ink-muted">
                Couldn't load stories. Try again later.
              </p>
            ) : filteredStories.length === 0 ? (
              <p className="py-6 text-center font-body italic text-sm text-ns-ink-muted">
                {storyQuery
                  ? "No published stories match your search."
                  : "No published stories yet."}
              </p>
            ) : (
              filteredStories.map((story) => (
                <StoryRow
                  key={story.id}
                  story={story}
                  onPick={(s) => onSelect(storyToBook(s))}
                />
              ))
            )}
            {hasNextPage && !storyQuery && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-2.5 font-ui text-[11px] uppercase tracking-widest text-ns-ink-muted hover:text-ns-accent transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="google">
          <BookSearch onBookSelect={(book) => onSelect(googleBookToBook(book))} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface BookPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel?: string;
  onConfirm: (book: IBookOfTheMonth) => Promise<void> | void;
}

/** Dialog wrapper around BookPicker with an explicit confirm step. */
export const BookPickerDialog = ({
  open,
  onOpenChange,
  title,
  confirmLabel = "Set as current book",
  onConfirm,
}: BookPickerDialogProps) => {
  const [pending, setPending] = useState<IBookOfTheMonth | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPending(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(pending);
      handleOpenChange(false);
    } catch (err: unknown) {
      console.error("Error confirming book selection:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-ns-ink">{title}</DialogTitle>
        </DialogHeader>

        <BookPicker onSelect={setPending} selected={pending} autoFocus />

        {error && (
          <p className="font-ui text-sm text-ns-accent" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!pending || isSaving}>
            {isSaving ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
