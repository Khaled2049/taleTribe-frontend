/**
 * Competition input validation — the authority.
 *
 * This logic used to live only in CompetitionService.sanitizeCompetitionInput
 * on the client, which was fine while competitions were decorative. Now that
 * creating one debits a real balance into escrow, the client copy is a UX
 * convenience and this copy is what actually decides.
 *
 * Errors carry `statusCode` so handlers can rethrow them straight to the
 * caller, matching the idiom already used in competitionEndpoints.ts.
 */
import {
  MinorUnits,
  ZERO,
  assertMinorUnits,
  getCompetitionFeeBps,
  isPositive,
} from "./money";

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_CATEGORY_LENGTH = 64;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 32;
export const MAX_PARTICIPANTS_CEILING = 10000;

/** Minimum gap between submissions closing and voting closing. */
export const MIN_VOTING_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const bad = (message: string, statusCode = 400): Error =>
  Object.assign(new Error(message), { statusCode });

export interface CompetitionInputPayload {
  title: string;
  description: string;
  category: string;
  tags: string[];
  maxParticipants: number | null;
  startDate: Date;
  deadline: Date;
  votingDeadline: Date;
  prizeAmount: MinorUnits;
  /** What each entrant pays to submit. "0" means the competition is free. */
  entryFee: MinorUnits;
  /** Platform's share of the entry fees, in basis points. */
  feeBps: number;
}

function requireString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") throw bad(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) throw bad(`${field} is required`);
  if (trimmed.length > maxLength) {
    throw bad(`${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

function requireDate(value: unknown, field: string): Date {
  if (typeof value !== "string" && typeof value !== "number") {
    throw bad(`${field} is invalid`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw bad(`${field} is invalid`);
  return date;
}

export function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw bad("Tags must be a list");

  const tags = Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, MAX_TAG_LENGTH)),
    ),
  );

  if (tags.length > MAX_TAGS) {
    throw bad(`A competition may have at most ${MAX_TAGS} tags`);
  }
  return tags;
}

/**
 * Validate a full competition payload.
 *
 * `now` is injectable so tests don't depend on the wall clock. Start dates in
 * the past are allowed — an admin may open a competition immediately — but the
 * ordering constraints between the three dates are strict.
 */
export function validateCompetitionInput(
  body: Record<string, unknown>,
): CompetitionInputPayload {
  const title = requireString(body.title, "Title", MAX_TITLE_LENGTH);
  const description = requireString(
    body.description,
    "Description",
    MAX_DESCRIPTION_LENGTH,
  );
  const category = requireString(body.category, "Category", MAX_CATEGORY_LENGTH);

  const startDate = requireDate(body.startDate, "Start date");
  const deadline = requireDate(body.deadline, "Deadline");
  const votingDeadline = requireDate(body.votingDeadline, "Voting deadline");

  if (deadline.getTime() <= startDate.getTime()) {
    throw bad("Deadline must be after the start date");
  }
  if (
    votingDeadline.getTime() - deadline.getTime() < MIN_VOTING_WINDOW_MS
  ) {
    throw bad("Voting must stay open for at least an hour after the deadline");
  }

  let maxParticipants: number | null = null;
  if (body.maxParticipants !== undefined && body.maxParticipants !== null) {
    const value = body.maxParticipants;
    if (!Number.isInteger(value) || (value as number) <= 0) {
      throw bad("Max participants must be a whole number greater than 0");
    }
    if ((value as number) > MAX_PARTICIPANTS_CEILING) {
      throw bad(`Max participants cannot exceed ${MAX_PARTICIPANTS_CEILING}`);
    }
    maxParticipants = value as number;
  }

  const prizeAmount = assertMinorUnits(body.prizeAmount, "prizeAmount");
  if (!isPositive(prizeAmount)) {
    // A zero-prize competition would have nothing to escrow, and nothing to
    // win. Allow it only once there's a reason to.
    throw bad("Prize amount must be greater than zero");
  }

  // Zero IS valid here, unlike the prize — a free competition is the default.
  const entryFee =
    body.entryFee === undefined || body.entryFee === null
      ? ZERO
      : assertMinorUnits(body.entryFee, "entryFee");

  return {
    title,
    description,
    category,
    tags: normalizeTags(body.tags),
    maxParticipants,
    startDate,
    deadline,
    votingDeadline,
    prizeAmount,
    entryFee,
    // Not taken from the request: the platform's cut is not the host's to set.
    feeBps: getCompetitionFeeBps(),
  };
}

/**
 * A draft in progress. Every field is optional except the title, because the
 * point of a draft is that it can be saved half-finished — the strict checks
 * belong at publish, where `validateCompetitionInput` runs over the finished
 * document.
 *
 * Dates are still ordered when present: catching an impossible window while the
 * host is typing is better than surfacing it only when they try to publish.
 */
export interface CompetitionDraftPayload {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  maxParticipants?: number | null;
  startDate?: Date;
  deadline?: Date;
  votingDeadline?: Date;
  prizeAmount?: MinorUnits;
  entryFee?: MinorUnits;
}

export function validateCompetitionDraft(
  body: Record<string, unknown>,
): CompetitionDraftPayload {
  const draft: CompetitionDraftPayload = {
    title: requireString(body.title, "Title", MAX_TITLE_LENGTH),
  };

  if (body.description !== undefined && body.description !== null) {
    const value = String(body.description).trim();
    if (value.length > MAX_DESCRIPTION_LENGTH) {
      throw bad(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
    }
    draft.description = value;
  }
  if (body.category !== undefined && body.category !== null) {
    const value = String(body.category).trim();
    if (value.length > MAX_CATEGORY_LENGTH) {
      throw bad(`Category must be ${MAX_CATEGORY_LENGTH} characters or fewer`);
    }
    draft.category = value;
  }
  if (body.tags !== undefined) {
    draft.tags = normalizeTags(body.tags);
  }
  if (body.maxParticipants !== undefined) {
    if (body.maxParticipants === null) {
      draft.maxParticipants = null;
    } else if (
      !Number.isInteger(body.maxParticipants) ||
      (body.maxParticipants as number) <= 0 ||
      (body.maxParticipants as number) > MAX_PARTICIPANTS_CEILING
    ) {
      throw bad("Max participants must be a whole number greater than 0");
    } else {
      draft.maxParticipants = body.maxParticipants as number;
    }
  }

  if (body.startDate !== undefined && body.startDate !== null) {
    draft.startDate = requireDate(body.startDate, "Start date");
  }
  if (body.deadline !== undefined && body.deadline !== null) {
    draft.deadline = requireDate(body.deadline, "Deadline");
  }
  if (body.votingDeadline !== undefined && body.votingDeadline !== null) {
    draft.votingDeadline = requireDate(body.votingDeadline, "Voting deadline");
  }
  assertDateOrdering(
    draft.startDate ?? null,
    draft.deadline ?? null,
    draft.votingDeadline ?? null,
  );

  // Zero is allowed on both here — an unfinished draft may not have priced
  // itself yet. `validateCompetitionInput` rejects a zero prize at publish.
  if (body.prizeAmount !== undefined && body.prizeAmount !== null) {
    draft.prizeAmount = assertMinorUnits(body.prizeAmount, "prizeAmount");
  }
  if (body.entryFee !== undefined && body.entryFee !== null) {
    draft.entryFee = assertMinorUnits(body.entryFee, "entryFee");
  }

  return draft;
}

/**
 * Validate a partial update to a PUBLISHED competition. The prize and the entry
 * fee are deliberately absent: both are immutable once escrow holds money
 * against them, so changing either is a cancel-and-recreate, not an edit. While
 * a competition is still a draft, `validateCompetitionDraft` accepts them.
 */
export function validateCompetitionUpdate(
  body: Record<string, unknown>,
): Partial<Omit<CompetitionInputPayload, "prizeAmount" | "entryFee" | "feeBps">> {
  const update: Partial<CompetitionInputPayload> = {};

  if (body.title !== undefined) {
    update.title = requireString(body.title, "Title", MAX_TITLE_LENGTH);
  }
  if (body.description !== undefined) {
    update.description = requireString(
      body.description,
      "Description",
      MAX_DESCRIPTION_LENGTH,
    );
  }
  if (body.category !== undefined) {
    update.category = requireString(
      body.category,
      "Category",
      MAX_CATEGORY_LENGTH,
    );
  }
  if (body.tags !== undefined) {
    update.tags = normalizeTags(body.tags);
  }
  if (body.maxParticipants !== undefined) {
    if (body.maxParticipants === null) {
      update.maxParticipants = null;
    } else if (
      !Number.isInteger(body.maxParticipants) ||
      (body.maxParticipants as number) <= 0 ||
      (body.maxParticipants as number) > MAX_PARTICIPANTS_CEILING
    ) {
      throw bad("Max participants must be a whole number greater than 0");
    } else {
      update.maxParticipants = body.maxParticipants as number;
    }
  }
  if (body.startDate !== undefined) {
    update.startDate = requireDate(body.startDate, "Start date");
  }
  if (body.deadline !== undefined) {
    update.deadline = requireDate(body.deadline, "Deadline");
  }
  if (body.votingDeadline !== undefined) {
    update.votingDeadline = requireDate(body.votingDeadline, "Voting deadline");
  }

  if (
    body.prizeAmount !== undefined ||
    body.prizeCurrency !== undefined ||
    body.payoutSplitBps !== undefined
  ) {
    throw bad("The prize cannot be changed after a competition is published", 422);
  }

  // Same reasoning as the prize: entrants have already paid the advertised fee,
  // and re-pricing would make escrow disagree with what the document claims.
  if (body.entryFee !== undefined || body.feeBps !== undefined) {
    throw bad(
      "The entry fee cannot be changed after a competition is published",
      422,
    );
  }

  return update;
}

/**
 * Re-check date ordering after merging an update over existing values, so a
 * partial edit can't produce an invalid combination.
 */
export function assertDateOrdering(
  startDate: Date | null,
  deadline: Date | null,
  votingDeadline: Date | null,
): void {
  // Nulls are skipped rather than rejected so a half-filled draft can be saved;
  // publish supplies all three, so nothing escapes unchecked.
  if (startDate && deadline && deadline.getTime() <= startDate.getTime()) {
    throw bad("Deadline must be after the start date");
  }
  if (
    deadline &&
    votingDeadline &&
    votingDeadline.getTime() - deadline.getTime() < MIN_VOTING_WINDOW_MS
  ) {
    throw bad("Voting must stay open for at least an hour after the deadline");
  }
}
