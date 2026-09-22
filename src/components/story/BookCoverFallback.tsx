import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type CoverSize = "tiny" | "small" | "medium" | "large";

interface BookCoverFallbackProps {
  title: string;
  author?: string | null;
  size?: CoverSize;
  className?: string;
}

const PALETTES = [
  { from: "#183447", to: "#517188", accent: "#f1d59d" },
  { from: "#392a3e", to: "#865b70", accent: "#f2d1ad" },
  { from: "#173b35", to: "#52796d", accent: "#efd89d" },
  { from: "#592f2b", to: "#aa674c", accent: "#f4d5a6" },
  { from: "#263252", to: "#687ba0", accent: "#e9d6ae" },
  { from: "#59421f", to: "#aa8245", accent: "#f4dfae" },
] as const;

const sizeClasses: Record<CoverSize, string> = {
  tiny: "p-1",
  small: "p-2",
  medium: "p-3",
  large: "p-5 sm:p-6",
};

const titleClasses: Record<CoverSize, string> = {
  tiny: "text-[6px] leading-[0.95] line-clamp-3",
  small: "text-[11px] leading-[0.95] line-clamp-4",
  medium: "text-lg leading-[0.92] line-clamp-4",
  large: "text-2xl sm:text-3xl leading-[0.9] line-clamp-5",
};

const authorClasses: Record<CoverSize, string> = {
  tiny: "text-[4px] leading-none truncate",
  small: "text-[6px] leading-tight truncate",
  medium: "text-[8px] leading-tight truncate",
  large: "text-[10px] leading-tight truncate",
};

function paletteFor(title: string) {
  const hash = Array.from(title).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return PALETTES[hash % PALETTES.length];
}

/**
 * A deterministic typographic jacket for stories that do not have cover art.
 * The title chooses the palette, so the same story keeps the same identity on
 * every shelf without persisting generated artwork.
 */
export function BookCoverFallback({
  title,
  author,
  size = "medium",
  className,
}: BookCoverFallbackProps) {
  const displayTitle = title.trim() || "Untitled story";
  const displayAuthor = author?.trim() || "TheTaleTribe author";
  const palette = paletteFor(displayTitle);
  const background = {
    backgroundColor: palette.from,
    backgroundImage: `radial-gradient(circle at 82% 12%, ${palette.accent}33 0, transparent 32%), radial-gradient(circle at 12% 92%, ${palette.to}99 0, transparent 42%), linear-gradient(145deg, ${palette.from} 0%, ${palette.to} 100%)`,
  } satisfies CSSProperties;

  return (
    <div
      role="img"
      aria-label={`${displayTitle}, written by ${displayAuthor}`}
      className={cn(
        "relative h-full w-full overflow-hidden bg-cover text-white",
        sizeClasses[size],
        className,
      )}
      style={background}
    >
      <span
        aria-hidden="true"
        className="absolute inset-[4px] rounded-[inherit] border border-white/20"
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[7%] bg-black/15 shadow-[2px_0_5px_rgba(0,0,0,0.2)]"
      />
      <span
        aria-hidden="true"
        className="absolute -right-[34%] -top-[8%] aspect-square w-[88%] rounded-full border border-white/10"
      />
      <span
        aria-hidden="true"
        className="absolute -right-[20%] top-[2%] aspect-square w-[55%] rounded-full border border-white/10"
      />

      <div className="relative z-[1] flex h-full min-h-0 flex-col pl-[5%]">
        {size !== "tiny" && (
          <p
            className={cn(
              "font-ui font-semibold uppercase text-white/65",
              size === "large"
                ? "text-[8px] tracking-[0.28em]"
                : "text-[5px] tracking-[0.2em]",
            )}
          >
            The Tale Tribe
          </p>
        )}

        <div className="flex min-h-0 flex-1 items-center py-1">
          <div className="min-w-0">
            <h3
              className={cn(
                "bg-gradient-to-b from-white via-white to-[#f1d7a6] bg-clip-text font-heading font-semibold italic tracking-[-0.03em] text-transparent [text-shadow:0_2px_12px_rgba(0,0,0,0.16)]",
                titleClasses[size],
              )}
            >
              {displayTitle}
            </h3>
            {size !== "tiny" && (
              <span
                aria-hidden="true"
                className="mt-1.5 block h-px w-7 bg-white/45"
              />
            )}
          </div>
        </div>

        <p
          className={cn(
            "font-ui uppercase tracking-[0.08em] text-white/75",
            authorClasses[size],
          )}
        >
          {size === "tiny" ? "by " : "written by "}
          <span className="font-semibold text-white">{displayAuthor}</span>
        </p>
      </div>
    </div>
  );
}
