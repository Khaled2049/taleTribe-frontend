type Recommendation = { title: string; detail: string };
type SuggestedChange = { operation: string; target: string; change: string };

export type SpecialistView = {
  name: string;
  reviewed: boolean;
  degraded: boolean;
  analysis: string;
  recommendations: Recommendation[];
  suggestedChanges: SuggestedChange[];
  risks: string[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

function items<T>(value: unknown, read: (row: unknown) => T | null): T[] {
  return Array.isArray(value)
    ? value.map(read).filter((row): row is T => row !== null)
    : [];
}

/**
 * A room-mode consult result as a view to show, or null when it is anything
 * else: an ordinary consult, a declined one, or a shape this build predates.
 * Tool results are model-derived data, so nothing here trusts their shape.
 */
export function specialistView(result: unknown): SpecialistView | null {
  const payload = record(result);
  const findings = record(payload?.findings);
  const analysis = text(findings?.analysis);
  if (!payload || payload.room !== true || payload.accepted !== true) {
    return null;
  }
  if (!findings || !analysis) return null;
  return {
    name: text(payload.name) || "Specialist",
    reviewed: payload.reviewed === true,
    degraded: payload.degraded === true,
    analysis,
    recommendations: items(findings.recommendations, (row) => {
      const item = record(row);
      const title = text(item?.title);
      return title ? { title, detail: text(item?.detail) } : null;
    }),
    suggestedChanges: items(findings.suggestedChanges, (row) => {
      const item = record(row);
      const change = text(item?.change);
      return change
        ? {
            operation: text(item?.operation),
            target: text(item?.target),
            change,
          }
        : null;
    }),
    risks: items(findings.risks, (row) => text(row) || null),
  };
}
