import { describe, expect, it } from "vitest";
import { PLOT_TEMPLATES } from "../src/components/plot/plotTemplates";
import {
  rowsForTemplate,
  selectedTemplateEvents,
} from "../src/components/plot/templatePreview";

describe("template preview", () => {
  it("creates only selected rows with edited text in the chosen order", () => {
    const rows = rowsForTemplate(PLOT_TEMPLATES[1]);
    rows[1].included = false;
    rows[2].name = "A different turn";
    rows[2].content = "New description";
    const reordered = [rows[2], rows[0], ...rows.slice(1, 2), ...rows.slice(3)];
    const events = selectedTemplateEvents(reordered);
    expect(events).toHaveLength(6);
    expect(events[0]).toMatchObject({
      name: "A different turn",
      content: "New description",
      orderIndex: 0,
      chapterId: null,
      status: "planned",
    });
    expect(events[1]).toMatchObject({
      name: "Setup",
      orderIndex: 1,
      storyBeat: "exposition",
    });
    expect(events.map((event) => event.name)).not.toContain(
      "Inciting incident",
    );
  });
});
