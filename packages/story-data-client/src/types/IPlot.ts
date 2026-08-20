// Story beat types for narrative structure
export type StoryBeatType =
  | "exposition"
  | "inciting_incident"
  | "rising_action"
  | "midpoint"
  | "climax"
  | "falling_action"
  | "resolution";

// Pacing types for scene rhythm
export type PacingType = "slow" | "moderate" | "fast";

// Time constraint for chronological ordering
export interface TimeConstraint {
  type: "absolute" | "relative";
  absoluteDate?: string; // ISO date or partial ("1985", "1985-06")
  relativeToEventId?: string;
  relativePosition?: "before" | "after" | "same_time";
  timeGap?: string; // "2 days later", "moments before"
}

// Event dependency for cause-effect relationships
export interface EventDependency {
  eventId: string;
  plotLineId: string;
  relationshipType:
    | "causes"
    | "requires"
    | "blocks"
    | "enables"
    | "contradicts";
  description?: string;
}

export interface PlotEvent {
  id: string;
  name: string;
  content: string;
  userId?: string; // Owner/creator of the event

  // Character & Location mapping (IDs, not embedded)
  characterIds: string[];
  locationId: string | null;

  // Dependencies (bidirectional for fast lookups)
  dependencies: EventDependency[];
  dependents: EventDependency[];

  // Tension & Pacing
  tensionLevel: number; // 1-10 scale
  pacing: PacingType;
  storyBeat: StoryBeatType;
  emotionalTone?: string;

  // Chronological constraints
  timeConstraint?: TimeConstraint;
  orderIndex: number;
  chapterNumber?: number; // Optional link to a chapter

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
