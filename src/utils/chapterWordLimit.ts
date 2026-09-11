// Keep these aligned with story-data and the agent write tools.
export const CHAPTER_WORD_LIMIT = 5000;
export const STORY_CHAPTER_LIMIT = 50;
export const CHAPTER_TITLE_LIMIT = 500;

// story-data counts whitespace-delimited runs in the stored HTML.
export function chapterWordCount(html: string): number {
  return html.match(/[^ \n\t\r]+/g)?.length ?? 0;
}
