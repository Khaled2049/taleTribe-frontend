export interface WritingGoalData {
  /** Target words per day; null when the writer has not set one. */
  goal: number | null;
  /** Local calendar day `written` belongs to, as YYYY-MM-DD. */
  day: string;
  /** Net words added that day. Deleting counts against it, so it can dip below zero. */
  written: number;
}

export const GOAL_PRESETS = [250, 500, 1000, 2000];

export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

export function dayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Adds a change in word count to today's total, starting over on a new day. */
export function recordWords(
  data: WritingGoalData,
  delta: number,
  today: string,
): WritingGoalData {
  const written = data.day === today ? data.written : 0;
  return { ...data, day: today, written: written + delta };
}

/** Words to show for today: yesterday's total and a net-negative day read as 0. */
export function wordsToday(data: WritingGoalData, today: string): number {
  return data.day === today ? Math.max(0, data.written) : 0;
}
