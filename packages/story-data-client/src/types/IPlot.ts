// Story beat types for narrative structure
export type StoryBeatType =
  | "exposition"
  | "inciting_incident"
  | "rising_action"
  | "midpoint"
  | "climax"
  | "falling_action"
  | "resolution";

// Writer-set progress of a planned event. Never inferred from the text.
export type PlotEventStatus = "planned" | "in_progress" | "written";

// Pacing types for scene rhythm
export type PacingType = "slow" | "moderate" | "fast";

export interface PlotEvent {
  id: string;
  name: string;
  content: string;
  userId?: string; // Owner/creator of the event

  // Character & Location mapping (IDs, not embedded)
  characterIds: string[];
  locationId: string | null;

  // Pacing
  pacing: PacingType;
  storyBeat: StoryBeatType;
  emotionalTone?: string;

  orderIndex: number;
  chapterId: string | null; // The chapter it is planned for; null when unassigned
  /** Place among the chapter's events across plot lines; server-owned, never sent. */
  chapterPosition?: number | null;
  status: PlotEventStatus;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  revision?: number;
}

export interface PlotLine {
  id: string;
  name: string;
  description: string;
  events: PlotEvent[];
  revision?: number;
}
