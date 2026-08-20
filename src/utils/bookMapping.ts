import { IBookOfTheMonth } from "@/types/IClub";
import { IBook } from "@/types/IBook";
import { StoryMetadata } from "@novelsync/story-data-client";

/**
 * Maps a published NovelSync story to the club book shape.
 * Firestore rejects `undefined` values, so optional keys are only
 * included when they carry a value.
 */
export function storyToBook(story: StoryMetadata): IBookOfTheMonth {
  const thumbnail = story.thumbnailUrl || story.coverImageUrl;
  return {
    id: story.id,
    source: "novelsync",
    storyId: story.id,
    ...(story.chapterCount ? { totalChapters: story.chapterCount } : {}),
    volumeInfo: {
      title: story.title,
      authors: [story.author],
      ...(story.description ? { description: story.description } : {}),
      ...(thumbnail ? { imageLinks: { thumbnail } } : {}),
    },
  };
}

/** Maps a Google Books search result to the club book shape. */
export function googleBookToBook(book: IBook): IBookOfTheMonth {
  return {
    id: book.id,
    source: "google",
    volumeInfo: {
      title: book.volumeInfo.title,
      ...(book.volumeInfo.authors ? { authors: book.volumeInfo.authors } : {}),
      ...(book.volumeInfo.description
        ? { description: book.volumeInfo.description }
        : {}),
      ...(book.volumeInfo.imageLinks?.thumbnail
        ? { imageLinks: { thumbnail: book.volumeInfo.imageLinks.thumbnail } }
        : {}),
    },
  };
}

/**
 * Legacy clubs store an all-empty-strings book object instead of omitting
 * the field — treat those as "no book chosen".
 */
export function hasBook(
  book: IBookOfTheMonth | null | undefined,
): book is IBookOfTheMonth {
  return !!book && !!book.id && !!book.volumeInfo?.title;
}
