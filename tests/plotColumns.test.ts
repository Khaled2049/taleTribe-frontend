import { describe, expect, it } from "vitest";
import {
  type ColumnId,
  gridTemplate,
  minRowWidth,
  OPTIONAL_COLUMNS,
  rememberedColumns,
  visibleColumns,
} from "@/components/plot/grid/plotColumns";

describe("visibleColumns", () => {
  it("shows the six default columns with nothing chosen", () => {
    expect(visibleColumns(new Set()).map((c) => c.label)).toEqual([
      "Event",
      "What happens",
      "Chapter",
      "Tension",
      "Status",
      "Actions",
    ]);
  });

  it("adds chosen extras in their place, not at the end", () => {
    const ids = visibleColumns(new Set<ColumnId>(["time", "cast"])).map(
      (c) => c.id,
    );
    expect(ids).toEqual([
      "event",
      "content",
      "chapter",
      "time",
      "tension",
      "status",
      "cast",
      "menu",
    ]);
  });

  it("offers time, pacing, beat and characters & location as extras", () => {
    expect(OPTIONAL_COLUMNS.map((c) => c.id)).toEqual([
      "time",
      "pacing",
      "beat",
      "cast",
    ]);
  });
});

describe("grid sizing", () => {
  it("fits the default columns on a 1280px laptop with the 320px sidebar open", () => {
    // 1280 - 320 sidebar - page padding and the workspace nav leave ~850px.
    expect(minRowWidth(visibleColumns(new Set()))).toBeLessThanOrEqual(850);
  });

  it("builds one grid track per column", () => {
    const columns = visibleColumns(new Set());
    expect(gridTemplate(columns).split(/ (?![^(]*\))/)).toHaveLength(
      columns.length,
    );
  });
});

describe("rememberedColumns", () => {
  it("is empty without storage", () => {
    expect(rememberedColumns().size).toBe(0);
  });
});
