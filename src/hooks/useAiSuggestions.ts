import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Editor } from "@tiptap/react";
import {
  generateNextLines,
} from "@/cloudFunctions/ai";

interface UseAiSuggestionsParams {
  storyId: string;
  chapterId?: string;
}

export function useAiSuggestions({
  storyId,
  chapterId,
}: UseAiSuggestionsParams) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestionMenu, setShowSuggestionMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchNextLineSuggestions = useCallback(
    async (editor: Editor) => {
      setIsGenerating(true);
      try {
        const content = editor.getHTML();
        const cursorPosition = editor.state.selection.from;

        const response = await generateNextLines({
          storyId,
          content,
          cursorPosition,
          chapterId,
        });

        const suggestionsArray =
          response.data && Array.isArray(response.data.suggestions)
            ? response.data.suggestions
            : [];

        if (suggestionsArray.length === 0) {
          toast.error("No suggestions were generated. Please try again.");
          return;
        }

        setSuggestions(suggestionsArray);
        setShowSuggestionMenu(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        toast.error(error instanceof Error ? error.message : "Failed to generate suggestions. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    [storyId, chapterId],
  );

  return {
    suggestions,
    setSuggestions,
    showSuggestionMenu,
    setShowSuggestionMenu,
    isGenerating,
    fetchNextLineSuggestions,
  };
}
