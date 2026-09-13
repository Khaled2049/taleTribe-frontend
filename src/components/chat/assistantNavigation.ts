export type AssistantNavigationTarget = {
  to: string;
  label: string;
  state?: { assistantChapterId: string };
};

function valueAt(value: unknown, key: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function stringAt(value: unknown, ...keys: string[]): string | null {
  for (const key of keys) {
    const candidate = valueAt(value, key);
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return null;
}

function entitySegment(kind: string | null): string | null {
  switch (kind?.toLowerCase()) {
    case "character":
    case "characters":
      return "characters";
    case "place":
    case "places":
      return "places";
    case "plot":
    case "plots":
    case "plot_line":
      return "plot";
    default:
      return null;
  }
}

/** Resolve only routes backed by an explicit workspace selection contract. */
export function toolNavigationTarget(
  storyId: string,
  toolName: string,
  args: unknown,
  result: unknown,
): AssistantNavigationTarget | null {
  const root = `/create/${encodeURIComponent(storyId)}`;
  if (toolName === "get_story_overview") {
    return { to: root, label: "Open editor" };
  }
  if (toolName === "read_chapter") {
    const chapterId =
      stringAt(args, "chapterId", "chapter_id") ??
      stringAt(result, "chapterId", "chapter_id");
    return chapterId
      ? {
          to: root,
          label: "Open chapter",
          state: { assistantChapterId: chapterId },
        }
      : { to: root, label: "Open editor" };
  }
  if (toolName === "list_story_entities" || toolName === "get_story_entity") {
    const segment = entitySegment(
      stringAt(args, "kind") ?? stringAt(result, "kind"),
    );
    if (segment) {
      return {
        to: `${root}/${segment}`,
        label: segment === "plot" ? "Open plot" : `Open ${segment}`,
      };
    }
  }
  return null;
}

export function safeWebReferenceUrl(
  kind: unknown,
  url: unknown,
): string | null {
  if (kind !== "web" || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
