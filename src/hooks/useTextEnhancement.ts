import { useState, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { enhanceText } from "@/cloudFunctions/ai";

interface UseTextEnhancementParams {
  editor: Editor | null;
  storyId: string;
  chapterId?: string;
  onError: (msg: string) => void;
}

export function useTextEnhancement({
  editor,
  storyId,
  chapterId,
  onError,
}: UseTextEnhancementParams) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleTextEnhancement = useCallback(
    async (action: "expand" | "dialogue" | "rewrite") => {
      if (!editor) return;

      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");

      if (!selectedText.trim()) {
        onError("Please select some text first");
        return;
      }

      setIsEnhancing(true);
      try {
        const response = await enhanceText({
          storyId,
          action,
          selectedText,
          chapterId,
        });
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, response.data.enhancedText)
          .run();
      } catch (error) {
        onError(
          error instanceof Error ? error.message : "Failed to enhance text",
        );
      } finally {
        setIsEnhancing(false);
      }
    },
    [editor, storyId, chapterId, onError],
  );

  return { isEnhancing, handleTextEnhancement };
}
