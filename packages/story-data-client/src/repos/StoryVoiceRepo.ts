import { request } from "../request.js";

export type StoryPointOfView =
  | "unspecified"
  | "first"
  | "close_third"
  | "omniscient"
  | "varies";
export type StoryTense = "unspecified" | "past" | "present" | "varies";

export interface StoryVoiceNote {
  id: string;
  text: string;
  origin: "writer" | "agent";
  pinned: boolean;
}

export interface StoryVoiceInput {
  pointOfView: StoryPointOfView;
  tense: StoryTense;
  notes: StoryVoiceNote[];
  learnFromWriting: boolean;
  references: StoryVoiceReference[];
}

export interface StoryVoiceReference {
  chapterId: string;
  sourceRevision: number;
  start: number;
  end: number;
}

export interface StoryVoiceProfile extends StoryVoiceInput {
  storyId: string;
  revision: number;
  updatedAt?: string;
}

export interface StoryVoiceChange {
  id: string;
  revisionBefore: number;
  revisionAfter: number;
  action: "save" | "agent" | "undo";
  before: StoryVoiceInput;
  after: StoryVoiceInput;
  undoOf?: string;
  reason?: string;
  evidence?: StoryVoiceReference[];
  createdAt: string;
}

export const storyVoiceRepo = {
  get(storyId: string, signal?: AbortSignal) {
    return request<StoryVoiceProfile>(`/v1/stories/${storyId}/voice-profile`, {
      auth: "required",
      label: "Story voice request",
      signal,
    });
  },
  save(storyId: string, revision: number, input: StoryVoiceInput) {
    return request<StoryVoiceProfile>(`/v1/stories/${storyId}/voice-profile`, {
      auth: "required",
      method: "PUT",
      revision,
      body: input,
      label: "Story voice save",
    });
  },
  history(storyId: string, signal?: AbortSignal) {
    return request<StoryVoiceChange[]>(`/v1/stories/${storyId}/voice-profile/history`, {
      auth: "required",
      label: "Story voice history request",
      signal,
    });
  },
  undo(storyId: string, revision: number, changeId: string) {
    return request<StoryVoiceProfile>(
      `/v1/stories/${storyId}/voice-profile/history/${changeId}/undo`,
      { auth: "required", method: "POST", revision, label: "Story voice undo" },
    );
  },
};
