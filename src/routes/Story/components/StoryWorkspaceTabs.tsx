import { Layers, MapPin, PenLine, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

interface StoryWorkspaceTabsProps {
  basePath: "/create" | "/try";
  storyId?: string;
  className?: string;
}

const NAV_ITEMS = [
  { label: "Editor", segment: "", icon: PenLine, end: true },
  { label: "Plot", segment: "plot", icon: Layers, end: false },
  { label: "Characters", segment: "characters", icon: Users, end: false },
  { label: "Places", segment: "places", icon: MapPin, end: false },
] as const;

function buildTo(
  basePath: "/create" | "/try",
  storyId: string | undefined,
  segment: string,
) {
  if (basePath === "/try") {
    return segment ? `/try/${segment}` : "/try";
  }

  const root = storyId ? `/create/${storyId}` : "/create";
  return segment ? `${root}/${segment}` : root;
}

export function StoryWorkspaceTabs({
  basePath,
  storyId,
  className = "",
}: StoryWorkspaceTabsProps) {
  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto border-b border-ns-border bg-ns-surface px-3 py-2 scrollbar-thin scrollbar-thumb-ns-border ${className}`}
    >
      {NAV_ITEMS.map(({ label, segment, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={buildTo(basePath, storyId, segment)}
          end={end}
          data-cy={`tab-${segment || "editor"}`}
          className={({ isActive }) =>
            `inline-flex shrink-0 items-center gap-1.5 rounded-ns px-3 py-1.5 font-ui text-xs transition-colors ${
              isActive
                ? "bg-ns-accent-subtle text-ns-accent font-medium"
                : "text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink"
            }`
          }
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}
