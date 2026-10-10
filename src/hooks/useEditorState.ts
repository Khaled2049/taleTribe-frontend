import { useReducer, useMemo } from "react";
import { Chapter, ChapterSummary, Story } from "@novelsync/story-data-client";
import { toChapterSummary } from "@/lib/chapterIndex";

// State type
export interface EditorState {
  story: Story | null;
  chapters: ChapterSummary[];
  currentChapter: Chapter | null;
  /** A selected chapter whose body is still loading; the canvas is read-only. */
  openingChapter: ChapterSummary | null;
  storyTitle: string;
  storyDescription: string;
  chapterTitle: string;
  isLoading: boolean;
  loadError: "missing" | "error" | null;
  leftSidebarOpen: boolean;
}

// Action types
type EditorAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_FAILED"; payload: "missing" | "error" }
  | {
      type: "LOAD_STORY";
      payload: {
        story: Story;
        chapters: ChapterSummary[];
        currentChapter: Chapter | null;
        leftSidebarOpen: boolean;
      };
    }
  | { type: "BEGIN_CHAPTER_OPEN"; payload: ChapterSummary }
  | { type: "CHAPTER_OPEN_FAILED" }
  | { type: "SELECT_CHAPTER"; payload: Chapter }
  | { type: "UPDATE_STORY_TITLE"; payload: string }
  | { type: "UPDATE_STORY_DESCRIPTION"; payload: string }
  | { type: "REPLACE_STORY"; payload: Story }
  | { type: "UPDATE_CHAPTER_TITLE"; payload: string }
  | { type: "ADD_CHAPTER"; payload: Chapter }
  | { type: "DELETE_CHAPTER"; payload: string }
  | {
      type: "UPDATE_CHAPTER_IN_LIST";
      payload: { id: string; updates: Partial<Chapter> };
    }
  | { type: "TOGGLE_LEFT_SIDEBAR" }
  | { type: "SET_LEFT_SIDEBAR"; payload: boolean }
  | { type: "SET_STORY_PUBLISHED"; payload: boolean }
  | { type: "RESET" };

export const initialEditorState: EditorState = {
  story: null,
  chapters: [],
  currentChapter: null,
  openingChapter: null,
  storyTitle: "",
  storyDescription: "",
  chapterTitle: "",
  isLoading: true,
  loadError: null,
  leftSidebarOpen: true,
};

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
        loadError: action.payload ? null : state.loadError,
      };

    case "LOAD_FAILED":
      return { ...state, isLoading: false, loadError: action.payload };

    case "LOAD_STORY":
      return {
        ...state,
        story: action.payload.story,
        chapters: action.payload.chapters,
        currentChapter: action.payload.currentChapter,
        openingChapter: null,
        storyTitle: action.payload.story.title,
        storyDescription: action.payload.story.description,
        chapterTitle: action.payload.currentChapter?.title || "",
        leftSidebarOpen: action.payload.leftSidebarOpen,
        isLoading: false,
        loadError: null,
      };

    case "BEGIN_CHAPTER_OPEN":
      return { ...state, openingChapter: action.payload };

    case "CHAPTER_OPEN_FAILED":
      return { ...state, openingChapter: null };

    case "SELECT_CHAPTER":
      return {
        ...state,
        currentChapter: action.payload,
        openingChapter: null,
        chapterTitle: action.payload.title,
      };

    case "UPDATE_STORY_TITLE":
      return {
        ...state,
        storyTitle: action.payload,
      };

    case "UPDATE_STORY_DESCRIPTION":
      return {
        ...state,
        storyDescription: action.payload,
      };

    case "REPLACE_STORY":
      return { ...state, story: action.payload };

    case "UPDATE_CHAPTER_TITLE":
      return {
        ...state,
        chapterTitle: action.payload,
      };

    case "ADD_CHAPTER":
      return {
        ...state,
        chapters: [...state.chapters, toChapterSummary(action.payload)],
        currentChapter: action.payload,
        openingChapter: null,
        chapterTitle: action.payload.title,
      };

    case "DELETE_CHAPTER": {
      const remainingChapters = state.chapters.filter(
        (ch) => ch.id !== action.payload,
      );
      const wasCurrentChapter = state.currentChapter?.id === action.payload;

      // The index holds no bodies, so the caller opens the next chapter.
      return {
        ...state,
        chapters: remainingChapters,
        currentChapter: wasCurrentChapter ? null : state.currentChapter,
        chapterTitle: wasCurrentChapter ? "" : state.chapterTitle,
      };
    }

    case "UPDATE_CHAPTER_IN_LIST":
      return {
        ...state,
        chapters: state.chapters.map((ch) =>
          ch.id === action.payload.id
            ? toChapterSummary({ ...ch, ...action.payload.updates })
            : ch,
        ),
        currentChapter:
          state.currentChapter?.id === action.payload.id
            ? { ...state.currentChapter, ...action.payload.updates }
            : state.currentChapter,
      };

    case "TOGGLE_LEFT_SIDEBAR":
      return { ...state, leftSidebarOpen: !state.leftSidebarOpen };

    case "SET_LEFT_SIDEBAR":
      return { ...state, leftSidebarOpen: action.payload };

    case "SET_STORY_PUBLISHED":
      if (!state.story) return state;
      return {
        ...state,
        story: { ...state.story, isPublished: action.payload },
      };

    case "RESET":
      return initialEditorState;

    default:
      return state;
  }
}

// Hook
export function useEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);

  // Action creators
  const actions = useMemo(
    () => ({
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),

      loadFailed: (reason: "missing" | "error") =>
        dispatch({ type: "LOAD_FAILED", payload: reason }),

      loadStory: (
        story: Story,
        chapters: ChapterSummary[],
        currentChapter: Chapter | null,
        options?: { leftSidebarOpen?: boolean },
      ) =>
        dispatch({
          type: "LOAD_STORY",
          payload: {
            story,
            chapters,
            currentChapter,
            leftSidebarOpen: options?.leftSidebarOpen ?? true,
          },
        }),

      beginChapterOpen: (chapter: ChapterSummary) =>
        dispatch({ type: "BEGIN_CHAPTER_OPEN", payload: chapter }),

      chapterOpenFailed: () => dispatch({ type: "CHAPTER_OPEN_FAILED" }),

      selectChapter: (chapter: Chapter) =>
        dispatch({ type: "SELECT_CHAPTER", payload: chapter }),

      updateStoryTitle: (title: string) =>
        dispatch({ type: "UPDATE_STORY_TITLE", payload: title }),

      updateStoryDescription: (description: string) =>
        dispatch({ type: "UPDATE_STORY_DESCRIPTION", payload: description }),

      replaceStory: (story: Story) =>
        dispatch({ type: "REPLACE_STORY", payload: story }),

      updateChapterTitle: (title: string) =>
        dispatch({ type: "UPDATE_CHAPTER_TITLE", payload: title }),

      addChapter: (chapter: Chapter) =>
        dispatch({ type: "ADD_CHAPTER", payload: chapter }),

      deleteChapter: (chapterId: string) =>
        dispatch({ type: "DELETE_CHAPTER", payload: chapterId }),

      updateChapterInList: (id: string, updates: Partial<Chapter>) =>
        dispatch({ type: "UPDATE_CHAPTER_IN_LIST", payload: { id, updates } }),

      toggleLeftSidebar: () => dispatch({ type: "TOGGLE_LEFT_SIDEBAR" }),

      setLeftSidebarOpen: (isOpen: boolean) =>
        dispatch({ type: "SET_LEFT_SIDEBAR", payload: isOpen }),

      setStoryPublished: (isPublished: boolean) =>
        dispatch({ type: "SET_STORY_PUBLISHED", payload: isPublished }),

      reset: () => dispatch({ type: "RESET" }),
    }),
    [],
  );

  // Computed values
  const currentContent = useMemo(
    () => state.currentChapter?.content || "",
    [state.currentChapter],
  );

  return {
    state,
    actions,
    currentContent,
  };
}
