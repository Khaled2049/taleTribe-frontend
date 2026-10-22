import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AlertTriangle, OctagonX } from "lucide-react";
import {
  dayLabel,
  formatCompact,
  labelledDays,
  meterLevel,
  niceTicks,
  number,
  projectToMidnight,
} from "@/lib/aiUsage";
import type { UsageColumn } from "./usageColumns";

// Series and meter colours are the dataviz reference palette, validated
// against the Inkwell page surface in both themes. Text never uses them.
export const VIZ_STYLE = `
.ai-usage {
  --series-1: #2a78d6; --series-2: #eb6834;
  --grid: #e1e0d9; --axis: #c3c2b7;
  --meter-track: #cde2fb; --meter-normal: #2a78d6;
  --meter-warning: #fab219; --meter-critical: #d03b3b;
}
.dark .ai-usage {
  --series-1: #3987e5; --series-2: #d95926;
  --grid: #2c2c2a; --axis: #383835;
  --meter-track: #104281; --meter-normal: #3987e5;
}`;

export const control =
  "rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50";
export const RANGES = [7, 30, 90] as const;
export function Meter({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
}) {
  const level = meterLevel(used, limit);
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  const projected = projectToMidnight(used);
  return (
    <div className="rounded-ns border border-ns-border p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium text-ns-ink-secondary">{label}</h3>
        <p className="text-sm text-ns-ink-secondary">
          of {number.format(limit)} {unit}
        </p>
      </div>
      <p className="mt-1 text-3xl font-semibold text-ns-ink">
        {number.format(used)}
      </p>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ background: "var(--meter-track)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${share * 100}%`,
            background: `var(--meter-${level})`,
          }}
        />
      </div>
      {level !== "normal" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-ns-ink">
          {level === "critical" ? (
            <OctagonX
              size={16}
              aria-hidden="true"
              style={{ color: "var(--meter-critical)" }}
            />
          ) : (
            <AlertTriangle
              size={16}
              aria-hidden="true"
              style={{ color: "var(--meter-warning)" }}
            />
          )}
          {level === "critical"
            ? "Cap reached: platform AI is refused until the reset"
            : "Over 80% of today's cap"}
        </p>
      )}
      <p className="mt-2 text-sm text-ns-ink-secondary">
        {projected === null
          ? "Too early in the UTC day to project."
          : `At this pace, about ${number.format(projected)} by midnight UTC (${Math.round((projected / limit) * 100)}% of the cap).`}
      </p>
    </div>
  );
}

export function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-ns border border-ns-border p-4">
      <p className="text-sm text-ns-ink-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ns-ink">{value}</p>
      {caption && <p className="mt-1 text-xs text-ns-ink-muted">{caption}</p>}
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Series {
  label: string;
  color: string;
  values: number[];
}

const PLOT = { top: 22, height: 180, axis: 26, left: 44, right: 8 };
const GAP = 2;

/** Rect with 4px-rounded top corners and a square base, per the mark spec. */
function columnPath(
  x: number,
  top: number,
  width: number,
  bottom: number,
  rounded: boolean,
) {
  const r = rounded ? Math.min(4, width / 2, bottom - top) : 0;
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`;
}

export function ColumnChart({
  title,
  description,
  days,
  series,
}: {
  title: string;
  description: string;
  days: { day: string }[];
  series: Series[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const count = days.length;
  const totals = days.map((_, i) =>
    series.reduce((sum, s) => sum + s.values[i], 0),
  );
  const ticks = niceTicks(Math.max(...totals, 0));
  const top = ticks[ticks.length - 1];
  const plotWidth = Math.max(0, width - PLOT.left - PLOT.right);
  const band = count ? plotWidth / count : 0;
  const barWidth = Math.max(2, Math.min(24, band * 0.6));
  const y = (value: number) =>
    PLOT.top + PLOT.height - (value / top) * PLOT.height;
  const labelled = labelledDays(count);
  const height = PLOT.top + PLOT.height + PLOT.axis;
  const last = count - 1;

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setActive((current) =>
        Math.min(last, Math.max(0, (current ?? last) + step)),
      );
    }
  }

  return (
    <figure className="rounded-ns border border-ns-border p-5">
      <figcaption>
        <h3 className="font-medium text-ns-ink">{title}</h3>
        <p className="mt-1 text-sm text-ns-ink-secondary">{description}</p>
      </figcaption>
      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-4 text-sm text-ns-ink-secondary">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="relative mt-4">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${title}. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            onKeyDown={onKey}
            onFocus={() => setActive((current) => current ?? last)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PLOT.left}
                  x2={width - PLOT.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth={1}
                />
                <text
                  x={PLOT.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-current text-[11px] text-ns-ink-muted"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatCompact(tick)}
                </text>
              </g>
            ))}
            {days.map((day, i) => {
              const x = PLOT.left + i * band + (band - barWidth) / 2;
              let base = 0;
              let topIndex = -1;
              series.forEach((s, index) => {
                if (s.values[i] > 0) topIndex = index;
              });
              return (
                <g key={day.day}>
                  {active === i && (
                    <rect
                      x={PLOT.left + i * band}
                      y={PLOT.top}
                      width={band}
                      height={PLOT.height}
                      className="fill-current text-ns-surface-hover"
                    />
                  )}
                  {series.map((s, index) => {
                    const value = s.values[i];
                    if (value <= 0) return null;
                    const gap = base > 0 ? GAP : 0;
                    const bottom = y(base) - gap;
                    base += value;
                    const segmentTop = y(base);
                    if (bottom - segmentTop < 0.5) return null;
                    return (
                      <path
                        key={s.label}
                        d={columnPath(
                          x,
                          segmentTop,
                          barWidth,
                          bottom,
                          index === topIndex,
                        )}
                        style={{ fill: s.color }}
                      />
                    );
                  })}
                  {labelled.has(i) && (
                    <text
                      x={PLOT.left + i * band + band / 2}
                      y={PLOT.top + PLOT.height + 18}
                      textAnchor="middle"
                      className="fill-current text-[11px] text-ns-ink-muted"
                    >
                      {dayLabel(day.day)}
                    </text>
                  )}
                  <rect
                    x={PLOT.left + i * band}
                    y={PLOT.top}
                    width={band}
                    height={PLOT.height}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                  />
                </g>
              );
            })}
            {count > 0 && totals[last] > 0 && (
              <text
                x={PLOT.left + last * band + band / 2}
                y={y(totals[last]) - 6}
                textAnchor="middle"
                className="fill-current text-[11px] font-medium text-ns-ink-secondary"
              >
                {formatCompact(totals[last])}
              </text>
            )}
          </svg>
        )}
        {active !== null && days[active] && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-[10rem] rounded-ns border border-ns-border bg-ns-elevated p-3 text-sm shadow-ns"
            style={{
              left: Math.min(
                Math.max(0, PLOT.left + active * band + band / 2 - 80),
                Math.max(0, width - 168),
              ),
            }}
          >
            <p className="text-xs text-ns-ink-muted">
              {dayLabel(days[active].day, "long")}
            </p>
            {series.map((s) => (
              <p key={s.label} className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ background: s.color }}
                />
                <strong className="font-semibold text-ns-ink">
                  {number.format(s.values[active])}
                </strong>
                <span className="text-ns-ink-secondary">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

export function UsageTable<T extends { day: string }>({
  days,
  columns,
}: {
  days: T[];
  columns: UsageColumn<T>[];
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full text-left text-sm"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <thead className="border-b border-ns-border text-ns-ink-secondary">
          <tr>
            {columns.map(([label]) => (
              <th
                key={label}
                scope="col"
                className="whitespace-nowrap pb-3 pr-6 font-medium"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((day) => (
            <tr key={day.day} className="border-b border-ns-border">
              {columns.map(([label, cell]) => (
                <td key={label} className="whitespace-nowrap py-2 pr-6">
                  {cell(day)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RangePicker({
  value,
  onChange,
  children,
}: {
  value: (typeof RANGES)[number];
  onChange: (days: (typeof RANGES)[number]) => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      {RANGES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`${control} ${value === option ? "border-ns-accent font-semibold" : ""}`}
        >
          Last {option} days
        </button>
      ))}
      {children}
    </div>
  );
}
