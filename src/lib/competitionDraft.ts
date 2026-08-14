import { parseTokenInput } from "@/lib/money";
import { MIN_VOTING_WINDOW_MS } from "@/lib/competitionListing";
import type { ICompetition, ICompetitionDraftInput } from "@/types/ICompetition";
import type { MinorUnits } from "@/types/IToken";

/**
 * The editor's form, as typed. Everything is a string because these are inputs;
 * conversion to dates and minor units happens on save.
 */
export interface CompetitionFormState {
  title: string;
  category: string;
  description: string;
  tags: string;
  /** Whole TALE as typed, e.g. "1000". */
  prizeAmount: string;
  /** Whole TALE as typed. Blank means free to enter. */
  entryFee: string;
  maxParticipants: string;
  /** `datetime-local` values. */
  startDate: string;
  deadline: string;
  votingDeadline: string;
}

const toDateTimeLocal = (date: Date): string => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function emptyFormState(): CompetitionFormState {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const deadline = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const votingDeadline = new Date(deadline.getTime() + 3 * 24 * 60 * 60 * 1000);

  return {
    title: "",
    category: "",
    description: "",
    tags: "",
    prizeAmount: "",
    entryFee: "",
    maxParticipants: "",
    startDate: toDateTimeLocal(start),
    deadline: toDateTimeLocal(deadline),
    votingDeadline: toDateTimeLocal(votingDeadline),
  };
}

export function formStateFrom(
  competition: ICompetition,
  formatAmount: (amount: MinorUnits, decimals: number) => string,
): CompetitionFormState {
  return {
    title: competition.title === "Untitled competition" ? "" : competition.title,
    category: competition.category === "General" ? "" : competition.category,
    description: competition.description,
    tags: competition.tags.join(", "),
    prizeAmount: competition.prizePool
      ? formatAmount(competition.prizePool.amount, competition.prizePool.decimals)
      : "",
    entryFee: competition.entryFee
      ? formatAmount(competition.entryFee.amount, competition.entryFee.decimals)
      : "",
    maxParticipants: competition.maxParticipants
      ? String(competition.maxParticipants)
      : "",
    startDate: toDateTimeLocal(competition.startDate),
    deadline: toDateTimeLocal(competition.deadline),
    votingDeadline: competition.votingDeadline
      ? toDateTimeLocal(competition.votingDeadline)
      : "",
  };
}

const parseTags = (raw: string): string[] =>
  raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const parseDate = (value: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Strip the punctuation people actually type into a money field.
 *
 * `parseTokenInput` only accepts bare digits, so "1,000" or "1000 TALE" would
 * be dropped silently — the summary showed "—" and the publish blocker said
 * "Set a prize amount" to someone who had just set one.
 */
export const normalizeAmountInput = (value: string): string =>
  value.replace(/,/g, "").replace(/\s/g, "").replace(/TALE$/i, "");

/** `undefined` when blank, `null` when present but unparseable. */
export const parseAmount = (
  value: string,
): MinorUnits | undefined | null => {
  const normalized = normalizeAmountInput(value);
  if (!normalized) return undefined;
  try {
    return parseTokenInput(normalized);
  } catch {
    return null;
  }
};

/** The amount when it is usable, `null` otherwise — for display bindings. */
export const amountOrNull = (value: string): MinorUnits | null => {
  const parsed = parseAmount(value);
  return parsed && BigInt(parsed) > 0n ? parsed : null;
};

/** Form -> the draft payload. Unparseable fields are simply omitted. */
export function toDraftInput(
  form: CompetitionFormState,
  competitionId: string | undefined,
  creatorName: string | undefined,
): ICompetitionDraftInput {
  return {
    ...(competitionId ? { competitionId } : {}),
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    tags: parseTags(form.tags),
    maxParticipants: form.maxParticipants
      ? Number(form.maxParticipants)
      : null,
    startDate: parseDate(form.startDate),
    deadline: parseDate(form.deadline),
    votingDeadline: parseDate(form.votingDeadline),
    prizeAmount: parseAmount(form.prizeAmount) ?? undefined,
    entryFee: parseAmount(form.entryFee) ?? undefined,
    creatorName,
  };
}

/**
 * Why this draft cannot be published yet, in the order a host would fix them.
 *
 * Mirrors `validateCompetitionInput` on the server, which is the authority — the
 * point here is that the Publish button can say what is missing instead of
 * failing on submit for something the page already knew.
 */
export function publishBlockers(form: CompetitionFormState): string[] {
  const blockers: string[] = [];

  if (!form.title.trim()) blockers.push("Add a title");
  if (!form.description.trim()) blockers.push("Add a description");
  if (!form.category.trim()) blockers.push("Add a category");

  // Distinguish "not filled in" from "filled in but unreadable" — telling
  // someone to set a prize they can see on screen is worse than saying nothing.
  const prize = parseAmount(form.prizeAmount);
  if (prize === undefined) {
    blockers.push("Set a prize amount");
  } else if (prize === null) {
    blockers.push("The prize amount isn't a number");
  } else if (BigInt(prize) <= 0n) {
    blockers.push("The prize must be greater than zero");
  }

  if (parseAmount(form.entryFee) === null) {
    blockers.push("The entry fee isn't a number");
  }

  const start = parseDate(form.startDate);
  const deadline = parseDate(form.deadline);
  const voting = parseDate(form.votingDeadline);

  if (!start) blockers.push("Set a start date");
  if (!deadline) blockers.push("Set a submissions deadline");
  if (!voting) blockers.push("Set a voting deadline");

  if (start && deadline && deadline.getTime() <= start.getTime()) {
    blockers.push("Submissions must close after the start date");
  }
  if (
    deadline &&
    voting &&
    voting.getTime() - deadline.getTime() < MIN_VOTING_WINDOW_MS
  ) {
    blockers.push("Voting must stay open at least an hour after submissions close");
  }

  return blockers;
}
