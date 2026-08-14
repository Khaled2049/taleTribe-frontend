import { cn } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";

/**
 * Shared shape of the competitions ledger table.
 *
 * Lives here rather than beside the row component because both the header (in
 * Competitions.tsx) and the rows need it, and a component file that also
 * exports data breaks fast refresh.
 */

/**
 * Column template shared by the ledger header and every row.
 *
 * The header and the rows are separate grid containers, so a track only lines
 * up if it resolves to the same width in both. That is why the status column is
 * a fixed width rather than `auto`: against the header's placeholder `auto`
 * collapses to near zero, the freed space is redistributed across the `fr`
 * tracks, and every header label ends up sitting off the values beneath it.
 *
 * Keep `gap-x-5` and the horizontal padding identical on both too — they change
 * the content box the `fr` tracks divide up.
 */
export const LEDGER_GRID =
  "grid-cols-[1fr_.8fr_176px] xl:grid-cols-[minmax(180px,1.6fr)_minmax(78px,.65fr)_minmax(84px,.8fr)_minmax(92px,.9fr)_minmax(92px,.9fr)_minmax(80px,.8fr)_120px]";

export type RowActionKey =
  | "register"
  | "enter"
  | "continue"
  | "vote"
  | "judging"
  | "results"
  | "cancelled";

export type RowActionTone = "live" | "joined" | "done";

/**
 * Every value the status pill can take, with what it means.
 *
 * `rowState` picks from this map and the header legend renders it, so the
 * explanation a reader hovers is generated from the same source that decides
 * what the pill says — a value cannot appear without being documented, and a
 * legend entry cannot describe a state that no longer exists.
 */
export const ROW_ACTION: Record<
  RowActionKey,
  { label: string; meaning: string; tone: RowActionTone }
> = {
  register: {
    label: "Register",
    tone: "live",
    meaning:
      "Not open yet. Join now and you'll be ready the moment entries open.",
  },
  enter: {
    label: "Enter",
    tone: "live",
    meaning: "Open for entries. Put one of your published stories in.",
  },
  continue: {
    label: "Continue",
    tone: "joined",
    meaning: "You've joined but haven't entered a story yet.",
  },
  vote: {
    label: "Vote",
    tone: "live",
    meaning:
      "Entries are closed and voting is open. You can back up to three entries.",
  },
  judging: {
    label: "Judging",
    tone: "done",
    meaning:
      "Voting has closed. Votes are being counted and the prize paid out.",
  },
  results: {
    label: "Results",
    tone: "done",
    meaning: "Finished. The winner and the full standings are published.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "done",
    meaning: "Called off before it finished. The prize went back to the host.",
  },
};

/** Legend order: the sequence a competition actually moves through. */
export const ROW_ACTION_ORDER: RowActionKey[] = [
  "register",
  "enter",
  "continue",
  "vote",
  "judging",
  "results",
  "cancelled",
];

/** Badge styling for a pill tone, shared by the rows and the header legend. */
export function actionBadgeProps(tone: RowActionTone): {
  variant: BadgeProps["variant"];
  className: string;
} {
  return {
    variant:
      tone === "joined" ? "outline" : tone === "done" ? "default" : "success",
    className: cn(
      "whitespace-nowrap",
      tone === "joined" && "border-ns-accent/30 text-ns-accent",
    ),
  };
}
