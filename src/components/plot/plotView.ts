export type PlotGrouping = "chapters" | "lines";

export interface PlotViewState {
  group: PlotGrouping;
}

// The outline grouped by chapter opens by default. Whether writers more often
// plan chapters first or events first is still open; flip it here.
export const DEFAULT_PLOT_VIEW: PlotViewState = { group: "chapters" };

const VIEW_KEY = "tale-tribe:plot-view";

const asGroup = (v: unknown): PlotGrouping | undefined =>
  v === "chapters" || v === "lines" ? v : undefined;

/** The URL wins, then this viewer's last choice, then the default. */
export function resolvePlotView(
  params: URLSearchParams,
  remembered: Partial<PlotViewState> | null,
): PlotViewState {
  return {
    group:
      asGroup(params.get("group")) ??
      asGroup(remembered?.group) ??
      DEFAULT_PLOT_VIEW.group,
  };
}

export function rememberedPlotView(): Partial<PlotViewState> | null {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function rememberPlotView(state: PlotViewState) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(state));
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}
