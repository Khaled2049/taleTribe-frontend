import type { PlotEvent } from "@novelsync/story-data-client";

// The plot wire types live in the story-data client. This module keeps what the
// API has no opinion about: the read-time backfill the UI applies, and the
// narrative templates offered in the plot editor.
export type {
  EventDependency,
  PacingType,
  PlotEvent,
  PlotEventStatus,
  PlotLine,
  StoryBeatType,
  TimeConstraint,
} from "@novelsync/story-data-client";

// Starting values for a new event. story-data returns every field on read.
export const DEFAULT_PLOT_EVENT_VALUES: Omit<
  PlotEvent,
  "id" | "name" | "content"
> = {
  characterIds: [],
  locationId: null,
  dependencies: [],
  dependents: [],
  tensionLevel: 5,
  pacing: "moderate",
  storyBeat: "rising_action",
  orderIndex: 0,
  chapterId: null,
  status: "planned",
};
