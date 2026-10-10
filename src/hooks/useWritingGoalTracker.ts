import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { countWords } from "@/lib/writingGoal";
import { useWritingGoalStore } from "@/stores/writingGoalStore";

function editorWordCount(editor: Editor): number {
  const { doc } = editor.state;
  return countWords(doc.textBetween(0, doc.content.size, " ", " "));
}

/**
 * Feeds the daily goal with the net words typed in the open chapter. Mount it
 * once per editor: every instance would count the same edits again.
 */
export function useWritingGoalTracker(
  editor: Editor | null,
  chapterId: string | undefined,
) {
  useEffect(() => {
    if (!editor || !chapterId) return;
    let last: number | null = null;
    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean; getMeta: (key: string) => unknown };
    }) => {
      if (!transaction.docChanged) return;
      const { goal, record } = useWritingGoalStore.getState();
      if (goal === null) {
        last = null;
        return;
      }
      const next = editorWordCount(editor);
      // A silent content swap (opening a chapter, loading the server's
      // version) replaces the text without the writer having written it.
      if (last !== null && !transaction.getMeta("preventUpdate")) {
        record(next - last);
      }
      last = next;
    };
    if (useWritingGoalStore.getState().goal !== null) {
      last = editorWordCount(editor);
    }
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, chapterId]);
}
