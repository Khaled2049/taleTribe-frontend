import { StoryBeatType, PacingType, PlotEventStatus } from "@/types/IPlot";

// Shared select options for plot event metadata, used by both the
// EventEditModal and the outline cards.

export const STORY_BEAT_OPTIONS: { value: StoryBeatType; label: string }[] = [
  { value: "exposition", label: "Exposition" },
  { value: "inciting_incident", label: "Inciting Incident" },
  { value: "rising_action", label: "Rising Action" },
  { value: "midpoint", label: "Midpoint" },
  { value: "climax", label: "Climax" },
  { value: "falling_action", label: "Falling Action" },
  { value: "resolution", label: "Resolution" },
];

export const PACING_OPTIONS: {
  value: PacingType;
  label: string;
  description: string;
}[] = [
  {
    value: "slow",
    label: "Slow",
    description: "Descriptive, atmospheric scenes",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Balanced narrative flow",
  },
  { value: "fast", label: "Fast", description: "Action-packed, quick cuts" },
];

export const STATUS_OPTIONS: { value: PlotEventStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "written", label: "Written" },
];
