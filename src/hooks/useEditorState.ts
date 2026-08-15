import { useReducer, useMemo } from "react";
import { Chapter, Story } from "@/types/IStory";

// State type
export interface EditorState {
  story: Story | null;
  chapters: Chapter[];
  currentChapter: Chapter | null;
  storyTitle: string;
  storyDescription: string;
  chapterTitle: string;
  isLoading: boolean;
  metadataChanged: boolean;
  activeTab: "chapters" | "ai";
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  rightTab: "format" | "document";
}

// Action types
type EditorAction =
  | { type: "SET_LOADING"; payload: boolean }
  | {
      type: "LOAD_STORY";
      payload: {
        story: Story;
        chapters: Chapter[];
        currentChapter: Chapter | null;
        leftSidebarOpen: boolean;
      };
    }
  | { type: "SELECT_CHAPTER"; payload: Chapter }
  | { type: "UPDATE_STORY_TITLE"; payload: string }
  | { type: "UPDATE_STORY_DESCRIPTION"; payload: string }
  | { type: "REPLACE_STORY"; payload: Story }
  | { type: "UPDATE_CHAPTER_TITLE"; payload: string }
  | { type: "UPDATE_CHAPTER_CONTENT"; payload: string }
  | { type: "ADD_CHAPTER"; payload: Chapter }
  | { type: "DELETE_CHAPTER"; payload: string }
  | {
      type: "UPDATE_CHAPTER_IN_LIST";
      payload: { id: string; updates: Partial<Chapter> };
    }
  | { type: "CLEAR_METADATA_CHANGED" }
  | { type: "SET_ACTIVE_TAB"; payload: "chapters" | "ai" }
  | { type: "TOGGLE_LEFT_SIDEBAR" }
  | { type: "TOGGLE_RIGHT_SIDEBAR" }
  | { type: "SET_LEFT_SIDEBAR"; payload: boolean }
  | { type: "SET_RIGHT_SIDEBAR"; payload: boolean }
  | { type: "SET_RIGHT_TAB"; payload: "format" | "document" }
  | { type: "SET_STORY_PUBLISHED"; payload: boolean }
  | { type: "RESET" };

// Initial state
const initialState: EditorState = {
  story: null,
  chapters: [],
  currentChapter: null,
  storyTitle: "",
  storyDescription: "",
  chapterTitle: "",
  isLoading: true,
  metadataChanged: false,
  activeTab: "chapters",
  leftSidebarOpen: true,
  rightSidebarOpen: false,
  rightTab: "format",
};

// Reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "LOAD_STORY":
      return {
        ...state,
        story: action.payload.story,
        chapters: action.payload.chapters,
        currentChapter: action.payload.currentChapter,
        storyTitle: action.payload.story.title,
        storyDescription: action.payload.story.description,
        chapterTitle: action.payload.currentChapter?.title || "",
        leftSidebarOpen: action.payload.leftSidebarOpen,
        rightSidebarOpen: false,
        isLoading: false,
        metadataChanged: false,
      };

    case "SELECT_CHAPTER":
      return {
        ...state,
        currentChapter: action.payload,
        chapterTitle: action.payload.title,
      };

    case "UPDATE_STORY_TITLE":
      return {
        ...state,
        storyTitle: action.payload,
        metadataChanged: true,
      };

    case "UPDATE_STORY_DESCRIPTION":
      return {
        ...state,
        storyDescription: action.payload,
        metadataChanged: true,
      };

    case "REPLACE_STORY":
      return { ...state, story: action.payload };

    case "UPDATE_CHAPTER_TITLE":
      return {
        ...state,
        chapterTitle: action.payload,
        metadataChanged: true,
      };

    case "UPDATE_CHAPTER_CONTENT":
      if (!state.currentChapter) return state;
      return {
        ...state,
        currentChapter: {
          ...state.currentChapter,
          content: action.payload,
        },
      };

    case "ADD_CHAPTER":
      return {
        ...state,
        chapters: [...state.chapters, action.payload],
        currentChapter: action.payload,
        chapterTitle: action.payload.title,
      };

    case "DELETE_CHAPTER": {
      const remainingChapters = state.chapters.filter(
        (ch) => ch.id !== action.payload,
      );
      const wasCurrentChapter = state.currentChapter?.id === action.payload;

      return {
        ...state,
        chapters: remainingChapters,
        currentChapter: wasCurrentChapter
          ? remainingChapters[0] || null
          : state.currentChapter,
        chapterTitle: wasCurrentChapter
          ? remainingChapters[0]?.title || ""
          : state.chapterTitle,
      };
    }

    case "UPDATE_CHAPTER_IN_LIST":
      return {
        ...state,
        chapters: state.chapters.map((ch) =>
          ch.id === action.payload.id
            ? { ...ch, ...action.payload.updates }
            : ch,
        ),
        currentChapter:
          state.currentChapter?.id === action.payload.id
            ? { ...state.currentChapter, ...action.payload.updates }
            : state.currentChapter,
      };

    case "CLEAR_METADATA_CHANGED":
      return { ...state, metadataChanged: false };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };

    case "TOGGLE_LEFT_SIDEBAR":
      return { ...state, leftSidebarOpen: !state.leftSidebarOpen };

    case "TOGGLE_RIGHT_SIDEBAR":
      return { ...state, rightSidebarOpen: !state.rightSidebarOpen };

    case "SET_LEFT_SIDEBAR":
      return { ...state, leftSidebarOpen: action.payload };

    case "SET_RIGHT_SIDEBAR":
      return { ...state, rightSidebarOpen: action.payload };

    case "SET_RIGHT_TAB":
      return { ...state, rightTab: action.payload };

    case "SET_STORY_PUBLISHED":
      if (!state.story) return state;
      return { ...state, story: { ...state.story, isPublished: action.payload } };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// Hook
export function useEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Action creators
  const actions = useMemo(
    () => ({
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),

      loadStory: (
        story: Story,
        chapters: Chapter[],
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

      updateChapterContent: (content: string) =>
        dispatch({ type: "UPDATE_CHAPTER_CONTENT", payload: content }),

      addChapter: (chapter: Chapter) =>
        dispatch({ type: "ADD_CHAPTER", payload: chapter }),

      deleteChapter: (chapterId: string) =>
        dispatch({ type: "DELETE_CHAPTER", payload: chapterId }),

      updateChapterInList: (id: string, updates: Partial<Chapter>) =>
        dispatch({ type: "UPDATE_CHAPTER_IN_LIST", payload: { id, updates } }),

      clearMetadataChanged: () => dispatch({ type: "CLEAR_METADATA_CHANGED" }),

      setActiveTab: (tab: "chapters" | "ai") =>
        dispatch({ type: "SET_ACTIVE_TAB", payload: tab }),

      toggleLeftSidebar: () => dispatch({ type: "TOGGLE_LEFT_SIDEBAR" }),

      toggleRightSidebar: () => dispatch({ type: "TOGGLE_RIGHT_SIDEBAR" }),

      setLeftSidebarOpen: (isOpen: boolean) =>
        dispatch({ type: "SET_LEFT_SIDEBAR", payload: isOpen }),

      setRightSidebarOpen: (isOpen: boolean) =>
        dispatch({ type: "SET_RIGHT_SIDEBAR", payload: isOpen }),

      setRightTab: (tab: "format" | "document") =>
        dispatch({ type: "SET_RIGHT_TAB", payload: tab }),

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
