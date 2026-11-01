// Prompts for the contextual Assistant actions, kept together for tuning
// against real output. They name things as the roster does, never by id: the
// Assistant resolves names through its read tools.

import type { ChapterOption } from "./plotChapters";

const named = (name: string, fallback: string) =>
  `“${name.trim() || fallback}”`;

export function developChapterPrompt(chapter: ChapterOption): string {
  return (
    `Help me develop the planned events for chapter ${chapter.number}, ` +
    `${named(chapter.title, "Untitled")}. Look at what leads into them and what ` +
    "they set up, then suggest how to strengthen them."
  );
}

export function strongerConsequencePrompt(
  eventName: string,
  plotLineName: string,
): string {
  return (
    `For the event ${named(eventName, "Untitled event")} in the plot line ` +
    `${named(plotLineName, "Untitled plot line")}, suggest a stronger ` +
    "consequence, and how it should change later events."
  );
}

export const CHECK_OUTLINE_PROMPT =
  "Review my whole outline for setups that are never paid off, events that " +
  "happen without a cause, and chapters where nothing changes.";
