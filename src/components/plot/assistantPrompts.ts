// Prompts for the contextual Assistant actions, kept together for tuning
// against real output. They name things as the roster does, never by id: the
// Assistant resolves names through its read tools.

const named = (name: string, fallback: string) =>
  `“${name.trim() || fallback}”`;

export function strongerConsequencePrompt(
  eventName: string,
  plotLineName: string,
): string {
  return (
    `For the event ${named(eventName, "Untitled event")} in the plot line ` +
    `${named(plotLineName, "Untitled plot line")}, suggest a stronger ` +
    "consequence, and how it should change later events."
  );
}
