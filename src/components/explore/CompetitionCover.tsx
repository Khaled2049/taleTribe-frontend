import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Competitions have no photographic imagery — every cover is generated from
 * the competition record so it looks the same everywhere without storing an
 * asset. The id is hashed into a fixed set of {angle, period, tint} triples,
 * not derived continuously, so the visual vocabulary stays small and
 * recognizable rather than a different stripe on every render.
 */
const COVER_VARIANTS: { angle: number; period: number; tint: "accent" | "gold" }[] = [
  { angle: 32, period: 9, tint: "accent" },
  { angle: 58, period: 11, tint: "gold" },
  { angle: 84, period: 8, tint: "accent" },
  { angle: 112, period: 13, tint: "gold" },
  { angle: 140, period: 10, tint: "accent" },
  { angle: 160, period: 14, tint: "gold" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function shortNameFrom(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(" ") || "Untitled";
}

export interface CompetitionCoverProps {
  competition: { id: string; title: string; category?: string };
  size?: "rail" | "hero";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CompetitionCoverProps["size"]>, { box: string; name: string }> = {
  rail: { box: "h-[88px] p-3", name: "text-[26px]" },
  hero: { box: "w-[250px] aspect-[3/4] p-[22px]", name: "text-[56px]" },
};

export function CompetitionCover({
  competition,
  size = "rail",
  className,
}: CompetitionCoverProps) {
  const variant = useMemo(
    () => COVER_VARIANTS[hashString(competition.id) % COVER_VARIANTS.length],
    [competition.id],
  );
  const tintVar = variant.tint === "gold" ? "var(--ns-gold-bright)" : "var(--ns-accent)";
  const dims = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        "relative flex flex-col justify-end overflow-hidden rounded-ns bg-ns-elevated",
        dims.box,
        className,
      )}
      style={{
        backgroundImage: `repeating-linear-gradient(${variant.angle}deg, ${tintVar}14 0 2px, transparent 2px ${variant.period}px)`,
      }}
    >
      {competition.category && (
        <span className="absolute left-3 top-3 font-ui text-[9px] font-semibold uppercase tracking-[0.2em] text-ns-ink-muted">
          {competition.category}
        </span>
      )}
      <span
        className={cn(
          "font-heading font-light leading-[0.9] text-ns-ink",
          dims.name,
        )}
      >
        {shortNameFrom(competition.title)}
      </span>
    </div>
  );
}

export default CompetitionCover;
