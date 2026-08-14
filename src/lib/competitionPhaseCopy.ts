import type { CompetitionPhase } from "@/types/ICompetition";

export interface PhaseCopy {
  /** Short status, e.g. shown in the hero eyebrow and the countdown card. */
  label: string;
  /** One sentence on what a reader can do right now. */
  blurb: string;
}

/**
 * The one place a phase gets its user-facing name.
 *
 * Shared by the competition detail page and the "how it works" explainer so the
 * two can't drift — an explainer that calls a phase something the product
 * doesn't is worse than no explainer. Wording that is specific to one surface
 * (the explainer's longer per-step prose) stays with that surface; only the
 * label and the one-line blurb are common.
 */
export const PHASE_COPY: Record<CompetitionPhase, PhaseCopy> = {
  // Host-facing only. A draft is private, so no reader ever sees this.
  draft: {
    label: "Draft",
    blurb: "Not published yet — only you can see this.",
  },
  scheduled: {
    label: "Not open yet",
    blurb: "Entries open when the competition starts.",
  },
  open: {
    label: "Open for entries",
    blurb: "Join, then enter one of your published stories.",
  },
  voting: {
    label: "Voting open",
    blurb:
      "Back up to three entries. Results stay hidden until voting closes — nobody can see who's ahead.",
  },
  settling: {
    label: "Counting votes",
    blurb: "Voting has closed and the prize is being paid out.",
  },
  settled: { label: "Settled", blurb: "The prize has been paid out." },
  cancelled: {
    label: "Cancelled",
    blurb: "This competition was cancelled and its prize refunded.",
  },
};
