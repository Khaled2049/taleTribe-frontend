import api, { getApiErrorMessage } from "./index";

// ---------------------------------------------------------------------------
// Brainstorm
// ---------------------------------------------------------------------------

export interface BrainstormIdeasRequest {
  storyId: string;
  type: "characters" | "plots" | "places" | "themes";
  prompt?: string;
  count?: number;
}

export interface BrainstormIdea {
  text: string;
}

export interface BrainstormIdeasResponse {
  data: {
    storyId: string;
    type: "characters" | "plots" | "places" | "themes";
    ideas: BrainstormIdea[];
  };
}

export const brainstormIdeas = async (
  request: BrainstormIdeasRequest,
): Promise<BrainstormIdeasResponse> => {
  try {
    const response = await api.post<BrainstormIdeasResponse>(
      "/brainstormIdeas",
      request,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(
      getApiErrorMessage(error, "Failed to generate brainstorm ideas"),
    );
  }
};

// ---------------------------------------------------------------------------
// Generate next lines
// ---------------------------------------------------------------------------

export interface GenerateNextLinesRequest {
  storyId: string;
  content: string;
  cursorPosition: number;
  chapterId?: string;
}

export interface GenerateNextLinesResponse {
  success: boolean;
  data: {
    storyId: string;
    suggestions: string[];
  };
  error: string | null;
}

export const generateNextLines = async (
  request: GenerateNextLinesRequest,
): Promise<GenerateNextLinesResponse> => {
  try {
    const response = await api.post<GenerateNextLinesResponse>(
      "/generateNextLines",
      request,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, "Failed to generate next lines"));
  }
};

// ---------------------------------------------------------------------------
// Summarize chapter (synchronous)
// ---------------------------------------------------------------------------

export interface SummarizeChapterRequest {
  storyId: string;
  chapterId: string;
}

export interface SummarizeChapterResponse {
  summary: string;
}

export const summarizeChapter = async (
  request: SummarizeChapterRequest,
): Promise<SummarizeChapterResponse> => {
  try {
    const response = await api.post<SummarizeChapterResponse>(
      "/summarizeChapter",
      request,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, "Failed to summarize chapter"));
  }
};

// ---------------------------------------------------------------------------
// Generate story choices
// ---------------------------------------------------------------------------

export interface StoryChoice {
  label: string;
  sceneText: string;
  isFinal?: boolean;
}

export interface GenerateStoryChoicesRequest {
  storyId: string;
  mode: "opening" | "continuation" | "ending";
  currentContent?: string;
  chapterId?: string;
  turnCount?: number;
}

export interface GenerateStoryChoicesResponse {
  openingScene?: string;
  choices: StoryChoice[];
}

export const generateStoryChoices = async (
  request: GenerateStoryChoicesRequest,
): Promise<GenerateStoryChoicesResponse> => {
  try {
    const response = await api.post<
      | { success: boolean; data: GenerateStoryChoicesResponse }
      | GenerateStoryChoicesResponse
    >("/generateStoryChoices", request);
    const responseData = response.data;
    if ("success" in responseData && "data" in responseData) {
      return (
        responseData as { success: boolean; data: GenerateStoryChoicesResponse }
      ).data;
    }
    return responseData as GenerateStoryChoicesResponse;
  } catch (error: unknown) {
    throw new Error(
      getApiErrorMessage(error, "Failed to generate story choices"),
    );
  }
};

// ---------------------------------------------------------------------------
// Enhance text
// ---------------------------------------------------------------------------

export interface EnhanceTextRequest {
  storyId: string;
  action: "expand" | "dialogue" | "rewrite";
  selectedText: string;
  chapterId?: string;
}

export interface EnhanceTextResponse {
  success: boolean;
  data: {
    storyId: string;
    action: string;
    enhancedText: string;
  };
  error: string | null;
}

export const enhanceText = async (
  request: EnhanceTextRequest,
): Promise<EnhanceTextResponse> => {
  try {
    const response = await api.post<EnhanceTextResponse>(
      "/enhanceText",
      request,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, "Failed to enhance text"));
  }
};

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export type WizardEnhanceType =
  | "premise"
  | "character"
  | "place"
  | "conflict"
  | "blueprint";

export interface WizardEnhanceRequest {
  type: WizardEnhanceType;
  data: Record<string, unknown>;
}

export interface BlueprintResult {
  premise?: string;
  characters?: {
    name: string;
    description: string;
    personality?: string;
    backstory?: string;
  }[];
  places?: {
    name: string;
    description: string;
    atmosphere?: string;
    history?: string;
  }[];
  conflict?: string;
}

export interface WizardEnhanceResponse {
  success: boolean;
  data?: {
    /** Single enhanced string — returned for premise/character/place/conflict types */
    enhanced?: string;
    /** Full enriched blueprint — returned for blueprint type */
    blueprint?: BlueprintResult;
  };
  error?: string;
}

export const enhanceWizardInput = async (
  request: WizardEnhanceRequest,
): Promise<WizardEnhanceResponse> => {
  const response = await api.post<WizardEnhanceResponse>(
    "/enhanceWizardInput",
    request,
  );
  return response.data;
};
