import React, { useId, useMemo, useState } from "react";
import {
  SidebarPanel,
  type SidebarPanelProps,
} from "@/components/layout/SidebarPanel";
import { chapterPlan } from "@/components/plot/chapterPlan";
import { usePlotLines } from "@/components/plot/usePlotLines";
import { ChapterPlanPanel } from "./ChapterPlanPanel";

type Tab = "chapters" | "plan";
const TAB_KEY = "tale-tribe:editor-side-tab";

function initialTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "plan" ? "plan" : "chapters";
  } catch {
    return "chapters";
  }
}

interface EditorSidePanelProps {
  storyId: string;
  sidebar: SidebarPanelProps;
}

/** The editor's left panel: the chapter list, or the plan for the open chapter. */
export const EditorSidePanel: React.FC<EditorSidePanelProps> = ({
  storyId,
  sidebar,
}) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const id = useId();
  const { plotLines } = usePlotLines(storyId);
  const planned = useMemo(
    () => chapterPlan(plotLines, sidebar.currentChapterId).length,
    [plotLines, sidebar.currentChapterId],
  );

  const choose = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice just isn't remembered.
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "chapters", label: sidebar.singleDocument ? "Outline" : "Chapters" },
    { key: "plan", label: planned > 0 ? `Plan · ${planned}` : "Plan" },
  ];

  return (
    <div className="h-full flex flex-col bg-ns-surface">
      <div
        role="tablist"
        aria-label="Side panel"
        className="flex-shrink-0 flex gap-1 px-3 pt-3 pr-10 border-b border-ns-border"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const next = tab === "chapters" ? "plan" : "chapters";
          choose(next);
          document.getElementById(`${id}-${next}-tab`)?.focus();
        }}
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            id={`${id}-${key}-tab`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => choose(key)}
            className={`px-3 py-2 -mb-px border-b-2 font-ui text-xs transition-colors ${
              tab === key
                ? "border-ns-accent text-ns-accent font-medium"
                : "border-transparent text-ns-ink-secondary hover:text-ns-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Both stay mounted: the chapter list holds a debounced title save
          that unmounting would cancel. */}
      <div
        id={`${id}-chapters-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-chapters-tab`}
        hidden={tab !== "chapters"}
        className="flex-1 min-h-0"
      >
        <SidebarPanel {...sidebar} />
      </div>
      <div
        id={`${id}-plan-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-plan-tab`}
        hidden={tab !== "plan"}
        className="flex-1 min-h-0"
      >
        <ChapterPlanPanel
          storyId={storyId}
          chapterId={sidebar.currentChapterId}
          chapters={sidebar.chapters}
        />
      </div>
    </div>
  );
};
