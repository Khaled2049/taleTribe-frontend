import { useEditorState, type Editor } from "@tiptap/react";
import { docWordCount } from "@/components/editor/docWordCount";
import { CHAPTER_WORD_LIMIT } from "@/utils/chapterWordLimit";
import { countWords } from "@/lib/writingGoal";

const NEAR_LIMIT = 0.9;

/**
 * The count story-data enforces, so the number that turns red is the one that
 * blocks typing. It re-renders on every edit; keep it a leaf.
 */
export function WordCount({ editor }: { editor: Editor | null }) {
  const count = useEditorState({
    editor,
    selector: () => {
      if (!editor) return null;
      const { doc, selection } = editor.state;
      return {
        words: docWordCount(doc),
        selected: selection.empty
          ? 0
          : countWords(doc.textBetween(selection.from, selection.to, " ", " ")),
      };
    },
  });
  if (!count) return null;
  const { words, selected } = count;

  const tone =
    words >= CHAPTER_WORD_LIMIT
      ? "text-ns-destructive"
      : words >= CHAPTER_WORD_LIMIT * NEAR_LIMIT
        ? "text-ns-gold"
        : "text-ns-ink-muted";
  return (
    <span
      className={`whitespace-nowrap font-ui text-xs tabular-nums ${tone}`}
      title="Words in this chapter, out of the chapter limit"
    >
      {selected > 0 && `${selected.toLocaleString()} selected · `}
      {words.toLocaleString()} / {CHAPTER_WORD_LIMIT.toLocaleString()} words
    </span>
  );
}
