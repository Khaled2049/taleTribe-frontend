import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PlotLine } from "@/types/IPlot";
import type { ChapterOption } from "../plotChapters";
import { STORY_BEAT_OPTIONS } from "../plotOptions";
import { buildShape, type ShapePoint, TENSION_TICKS } from "./shapeData";
import "./tensionChart.css";

interface TensionChartProps {
  lines: PlotLine[];
  chapters: ChapterOption[];
  onOpenEvent: (eventId: string) => void;
  onShowUnassigned: () => void;
}

const M = { top: 30, right: 16, bottom: 28, left: 36 };
const PLOT_H = 220;
const HEIGHT = M.top + PLOT_H + M.bottom;
const MIN_STEP = 28;

const seriesColor = (slot: number | null) =>
  slot ? `var(--series-${slot})` : "var(--series-other)";

/** A distinct marker per slot: identity never rides on colour alone. */
function markerPath(slot: number | null, x: number, y: number, r = 4.5) {
  switch (slot) {
    case 2:
      return `M${x - r},${y - r}h${2 * r}v${2 * r}h${-2 * r}z`;
    case 3:
      return `M${x},${y - r * 1.3}L${x + r * 1.3},${y}L${x},${y + r * 1.3}L${x - r * 1.3},${y}z`;
    case 4:
      return `M${x},${y - r * 1.2}L${x + r * 1.2},${y + r}L${x - r * 1.2},${y + r}z`;
    case 5:
      return `M${x},${y + r * 1.2}L${x + r * 1.2},${y - r}L${x - r * 1.2},${y - r}z`;
    case 6: {
      const t = r * 0.45;
      return `M${x - t},${y - r}h${2 * t}v${r - t}h${r - t}v${2 * t}h${t - r}v${r - t}h${-2 * t}v${t - r}h${t - r}v${-2 * t}h${r - t}z`;
    }
    case 7: {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${x + r * 1.15 * Math.cos(a)},${y + r * 1.15 * Math.sin(a)}`;
      });
      return `M${pts.join("L")}z`;
    }
    case 8: {
      const pts = Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + ((2 * Math.PI) / 5) * i;
        return `${x + r * 1.2 * Math.cos(a)},${y + r * 1.2 * Math.sin(a)}`;
      });
      return `M${pts.join("L")}z`;
    }
    default:
      return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  }
}

const beatLabel = (value: string) =>
  STORY_BEAT_OPTIONS.find((o) => o.value === value)?.label ?? value;

const LegendKey: React.FC<{ slot: number | null }> = ({ slot }) => (
  <svg width="26" height="12" aria-hidden className="flex-shrink-0">
    <line
      x1="1"
      x2="25"
      y1="6"
      y2="6"
      stroke={seriesColor(slot)}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d={markerPath(slot, 13, 6, 3.5)}
      fill={seriesColor(slot)}
      stroke="var(--ns-elevated)"
      strokeWidth="1.5"
    />
  </svg>
);

export const TensionChart: React.FC<TensionChartProps> = ({
  lines,
  chapters,
  onOpenEvent,
  onShowUnassigned,
}) => {
  const data = useMemo(() => buildShape(lines, chapters), [lines, chapters]);
  const [focusLine, setFocusLine] = useState("");
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<ShapePoint | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(720);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setBoxWidth(entry.contentRect.width),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [asTable]);

  const n = data.points.length;
  const step = Math.max(
    MIN_STEP,
    (boxWidth - M.left - M.right) / Math.max(n, 1),
  );
  const width = M.left + M.right + step * n;
  const xAt = (i: number) => M.left + step * (i + 0.5);
  const yAt = (v: number) => M.top + PLOT_H * (1 - v / 10);
  const dim = (lineId: string) => (focusLine && focusLine !== lineId ? 0.2 : 1);

  if (n === 0) {
    return (
      <div className="rounded-ns-lg border border-ns-border bg-ns-elevated px-6 py-12 text-center space-y-2">
        <p className="font-heading italic text-xl text-ns-ink-secondary">
          No shape to show yet
        </p>
        <p className="font-ui text-sm text-ns-ink-muted">
          Assign events to chapters to see the story's shape.
        </p>
        {data.unassigned > 0 && (
          <button
            type="button"
            onClick={onShowUnassigned}
            className="font-ui text-xs font-medium text-ns-accent hover:underline"
          >
            Show the {data.unassigned} unassigned{" "}
            {data.unassigned === 1 ? "event" : "events"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ns-tension-chart space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Highlight a plot line"
          value={focusLine}
          onChange={(e) => setFocusLine(e.target.value)}
          className="rounded-ns border border-ns-border bg-ns-surface px-2 py-1 font-ui text-xs text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent"
        >
          <option value="">All plot lines</option>
          {data.series.map(({ line }) => (
            <option key={line.id} value={line.id}>
              {line.name || "Untitled plot line"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="px-2.5 py-1 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink"
        >
          {asTable ? "Show as chart" : "Show as table"}
        </button>
      </div>

      <div className="rounded-ns-lg border border-ns-border bg-ns-elevated p-4 space-y-3">
        <div>
          <h3 className="font-ui text-sm font-semibold text-ns-ink">
            Planned tension
          </h3>
          <p className="font-ui text-xs text-ns-ink-muted">
            From your ratings, in reading order. Flat stretches and sharp turns
            are yours to judge.
          </p>
        </div>

        {data.series.length > 1 && (
          <ul
            aria-label="Plot lines"
            className="flex flex-wrap gap-x-4 gap-y-1"
          >
            {data.series.map(({ line, slot }) => (
              <li
                key={line.id}
                className="flex items-center gap-1.5 font-ui text-xs text-ns-ink-secondary"
                style={{ opacity: dim(line.id) === 1 ? 1 : 0.5 }}
              >
                <LegendKey slot={slot} />
                {line.name || "Untitled plot line"}
              </li>
            ))}
          </ul>
        )}

        {asTable ? (
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-sm">
              <caption className="sr-only">
                Planned tension of each event, in reading order
              </caption>
              <thead>
                <tr className="text-left text-xs text-ns-ink-muted border-b border-ns-border">
                  <th className="py-1.5 pr-3 font-medium">#</th>
                  <th className="py-1.5 pr-3 font-medium">Chapter</th>
                  <th className="py-1.5 pr-3 font-medium">Event</th>
                  <th className="py-1.5 pr-3 font-medium">Plot line</th>
                  <th className="py-1.5 pr-3 font-medium text-right">
                    Tension
                  </th>
                  <th className="py-1.5 font-medium">Beat</th>
                </tr>
              </thead>
              <tbody>
                {data.points.map((p) => (
                  <tr key={p.event.id} className="border-b border-ns-border">
                    <td className="py-1.5 pr-3 tabular-nums text-ns-ink-muted">
                      {p.x + 1}
                    </td>
                    <td className="py-1.5 pr-3 text-ns-ink-secondary">
                      {p.chapter.label}
                    </td>
                    <td className="py-1.5 pr-3">
                      <button
                        type="button"
                        onClick={() => onOpenEvent(p.event.id)}
                        className="text-left text-ns-ink hover:text-ns-accent hover:underline"
                      >
                        {p.event.name || "Untitled event"}
                      </button>
                    </td>
                    <td className="py-1.5 pr-3 text-ns-ink-secondary">
                      {p.line.name}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-ns-ink">
                      {p.event.tensionLevel}
                    </td>
                    <td className="py-1.5 text-ns-ink-secondary">
                      {beatLabel(p.event.storyBeat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={boxRef} className="relative overflow-x-auto">
            <svg
              width={width}
              height={HEIGHT}
              role="group"
              aria-label={`Planned tension of ${n} events in reading order. Each point is a button that opens its event; the table view has every value.`}
              className="block"
              onMouseLeave={() => setActive(null)}
            >
              {data.bands.map((band, i) => {
                const x0 = M.left + step * band.from;
                const w = step * (band.to - band.from + 1);
                const fits = Math.floor(w / 6.5);
                const text =
                  band.chapter.label.length <= fits
                    ? band.chapter.label
                    : fits >= 6
                      ? `${band.chapter.label.slice(0, fits - 1)}…`
                      : String(band.chapter.number);
                return (
                  <g key={band.chapter.id}>
                    {i % 2 === 0 && (
                      <rect
                        x={x0}
                        y={M.top - 22}
                        width={w}
                        height={PLOT_H + 22}
                        fill="var(--ns-surface)"
                      />
                    )}
                    <text
                      x={x0 + 4}
                      y={M.top - 9}
                      className="font-ui"
                      fontSize="10"
                      fill="var(--ns-ink-muted)"
                    >
                      <title>{`Chapter ${band.chapter.label}`}</title>
                      {text}
                    </text>
                  </g>
                );
              })}

              {TENSION_TICKS.map((t) => (
                <g key={t}>
                  <line
                    x1={M.left}
                    x2={width - M.right}
                    y1={yAt(t)}
                    y2={yAt(t)}
                    stroke="var(--ns-border)"
                    strokeWidth="1"
                  />
                  <text
                    x={M.left - 8}
                    y={yAt(t) + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--ns-ink-muted)"
                    className="font-ui tabular-nums"
                  >
                    {t}
                  </text>
                </g>
              ))}
              <text
                x={M.left}
                y={HEIGHT - 8}
                fontSize="10"
                fill="var(--ns-ink-muted)"
                className="font-ui"
              >
                Reading order →
              </text>

              {active && (
                <line
                  x1={xAt(active.x)}
                  x2={xAt(active.x)}
                  y1={M.top}
                  y2={M.top + PLOT_H}
                  stroke="var(--ns-border-strong)"
                  strokeWidth="1"
                />
              )}

              {data.series.map(({ line, slot, points }) => (
                <g key={line.id} opacity={dim(line.id)}>
                  {points.length > 1 && (
                    <path
                      d={points
                        .map(
                          (p, i) =>
                            `${i ? "L" : "M"}${xAt(p.x)},${yAt(p.event.tensionLevel)}`,
                        )
                        .join("")}
                      fill="none"
                      stroke={seriesColor(slot)}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {points.map((p) => (
                    <path
                      key={p.event.id}
                      d={markerPath(slot, xAt(p.x), yAt(p.event.tensionLevel))}
                      fill={seriesColor(slot)}
                      stroke="var(--ns-elevated)"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              ))}

              {/* One hit column per point: the pointer finds the reading position,
                  not a 9px marker. Keyboard focus shows the same readout. */}
              {data.points.map((p) => (
                <g
                  key={p.event.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.event.name || "Untitled event"}, ${p.line.name}, chapter ${p.chapter.label}, tension ${p.event.tensionLevel}. Opens the event.`}
                  onMouseEnter={() => setActive(p)}
                  onFocus={() => {
                    setActive(p);
                    setFocused(p.event.id);
                  }}
                  onBlur={() => {
                    setActive(null);
                    setFocused(null);
                  }}
                  onClick={() => onOpenEvent(p.event.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenEvent(p.event.id);
                    }
                  }}
                  className="cursor-pointer focus:outline-none"
                >
                  <rect
                    x={M.left + step * p.x}
                    y={M.top}
                    width={step}
                    height={PLOT_H}
                    fill="transparent"
                  />
                  <circle
                    cx={xAt(p.x)}
                    cy={yAt(p.event.tensionLevel)}
                    r="9"
                    fill="none"
                    stroke="var(--ns-accent)"
                    strokeWidth="2"
                    opacity={focused === p.event.id ? 1 : 0}
                  />
                </g>
              ))}
            </svg>

            {active && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-2 z-10 w-56 rounded-ns-lg border border-ns-border bg-ns-elevated p-2.5 shadow-ns-lg font-ui"
                style={
                  xAt(active.x) + 240 > width
                    ? { left: Math.max(0, xAt(active.x) - 236) }
                    : { left: xAt(active.x) + 12 }
                }
              >
                <p className="text-sm font-semibold text-ns-ink">
                  Tension {active.event.tensionLevel}
                </p>
                <p className="text-xs text-ns-ink truncate">
                  {active.event.name || "Untitled event"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ns-ink-secondary">
                  <svg width="14" height="4" aria-hidden>
                    <line
                      x1="1"
                      x2="13"
                      y1="2"
                      y2="2"
                      stroke={seriesColor(active.slot)}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="truncate">{active.line.name}</span>
                </p>
                <p className="text-[11px] text-ns-ink-muted truncate">
                  Chapter {active.chapter.label} ·{" "}
                  {beatLabel(active.event.storyBeat)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {data.unassigned > 0 && (
        <p className="font-ui text-xs text-ns-ink-muted">
          {data.unassigned === 1
            ? "1 unassigned event isn't shown. "
            : `${data.unassigned} unassigned events aren't shown. `}
          <button
            type="button"
            onClick={onShowUnassigned}
            className="font-medium text-ns-accent hover:underline"
          >
            Show unassigned
          </button>
        </p>
      )}
    </div>
  );
};
