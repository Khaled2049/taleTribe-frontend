import type { PlotEvent } from "@/types/IPlot";
import { DEFAULT_PLOT_EVENT_VALUES } from "@/types/IPlot";
import type { TemplateData } from "./plotTemplates";

export type PreviewRow = {
  key: string;
  included: boolean;
  name: string;
  content: string;
  storyBeat: PlotEvent["storyBeat"];
};

export const rowsForTemplate = (template: TemplateData): PreviewRow[] =>
  template.events.map((event, index) => ({
    key: `${template.id}:${index}`,
    included: true,
    name: event.name,
    content: event.content,
    storyBeat: event.storyBeat ?? "rising_action",
  }));

export const selectedTemplateEvents = (
  rows: PreviewRow[],
): Omit<PlotEvent, "id" | "revision">[] =>
  rows
    .filter((row) => row.included)
    .map((row, index) => ({
      ...DEFAULT_PLOT_EVENT_VALUES,
      name: row.name.trim(),
      content: row.content,
      storyBeat: row.storyBeat,
      orderIndex: index,
    }));
