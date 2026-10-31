export type ColumnId =
  | "event"
  | "content"
  | "chapter"
  | "time"
  | "tension"
  | "status"
  | "pacing"
  | "beat"
  | "cast"
  | "menu";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** CSS grid track at md+. */
  track: string;
  /** Narrowest the track gets, for the row's minimum width. */
  minPx: number;
  optional: boolean;
}

/** In display order. Optional columns are off until the writer picks them. */
export const COLUMNS: ColumnDef[] = [
  {
    id: "event",
    label: "Event",
    track: "minmax(140px,1.2fr)",
    minPx: 140,
    optional: false,
  },
  {
    id: "content",
    label: "What happens",
    track: "minmax(220px,2.4fr)",
    minPx: 220,
    optional: false,
  },
  {
    id: "chapter",
    label: "Chapter",
    track: "150px",
    minPx: 150,
    optional: false,
  },
  { id: "time", label: "Time", track: "120px", minPx: 120, optional: true },
  {
    id: "tension",
    label: "Tension",
    track: "76px",
    minPx: 76,
    optional: false,
  },
  {
    id: "status",
    label: "Status",
    track: "120px",
    minPx: 120,
    optional: false,
  },
  { id: "pacing", label: "Pacing", track: "110px", minPx: 110, optional: true },
  { id: "beat", label: "Beat", track: "140px", minPx: 140, optional: true },
  {
    id: "cast",
    label: "Characters & location",
    track: "160px",
    minPx: 160,
    optional: true,
  },
  { id: "menu", label: "Actions", track: "44px", minPx: 44, optional: false },
];

export const OPTIONAL_COLUMNS = COLUMNS.filter((c) => c.optional);

/** The left rail holding the drag handle and row number. */
export const RAIL_PX = 44;

export function visibleColumns(chosen: ReadonlySet<ColumnId>): ColumnDef[] {
  return COLUMNS.filter((c) => !c.optional || chosen.has(c.id));
}

export const gridTemplate = (columns: ColumnDef[]) =>
  columns.map((c) => c.track).join(" ");

/** Width below which the row scrolls sideways rather than squeezing. */
export const minRowWidth = (columns: ColumnDef[]) =>
  RAIL_PX + columns.reduce((sum, c) => sum + c.minPx, 0);

const COLUMNS_KEY = "tale-tribe:plot-grid-columns";

export function rememberedColumns(): Set<ColumnId> {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(COLUMNS_KEY) ?? "[]",
    );
    const optional = new Set<string>(OPTIONAL_COLUMNS.map((c) => c.id));
    return new Set(
      (Array.isArray(saved) ? saved : []).filter(
        (id): id is ColumnId => typeof id === "string" && optional.has(id),
      ),
    );
  } catch {
    return new Set();
  }
}

export function rememberColumns(chosen: ReadonlySet<ColumnId>) {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify([...chosen]));
  } catch {
    // Not remembered without storage; the choice still applies now.
  }
}
