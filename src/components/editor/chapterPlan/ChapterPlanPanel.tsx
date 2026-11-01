import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Layers, Pencil, Sparkles } from "lucide-react";
import type { ChapterSummary } from "@novelsync/story-data-client";
import { useCharacters } from "@/hooks/queries/useCharacterQueries";
import { usePlaces } from "@/hooks/queries/usePlaceQueries";
import type { PlotEvent } from "@/types/IPlot";
import { EventEditModal } from "@/components/plot/EventEditModal";
import { EventStatusControl } from "@/components/plot/EventStatusControl";
import { EventSummary } from "@/components/plot/EventSummary";
import { chapterFor, chapterOptions } from "@/components/plot/plotChapters";
import { developChapterPrompt } from "@/components/plot/assistantPrompts";
import { openAssistantWith } from "@/components/chat/assistantPrompt";
import { ASSISTANT_UI_ENABLED } from "@/config/featureFlags";
import {
  chapterPlan,
  planSummary,
  plotEventPath,
} from "@/components/plot/chapterPlan";
import { usePlotLines } from "@/components/plot/usePlotLines";

interface ChapterPlanPanelProps {
  storyId: string;
  chapterId: string;
  chapters: ChapterSummary[];
}

const actionClass =
  "inline-flex items-center gap-1 px-2 py-1 rounded-ns font-ui text-[11px] text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors";

export const ChapterPlanPanel: React.FC<ChapterPlanPanelProps> = ({
  storyId,
  chapterId,
  chapters,
}) => {
  const navigate = useNavigate();
  const { plotLines, updateEvent, query } = usePlotLines(storyId);
  const { data: characters = [] } = useCharacters(storyId);
  const { data: places = [] } = usePlaces(storyId);
  const options = useMemo(() => chapterOptions(chapters), [chapters]);
  const chapter = chapterFor(options, chapterId);
  const plan = useMemo(
    () => chapterPlan(plotLines, chapterId),
    [plotLines, chapterId],
  );
  const [editing, setEditing] = useState<{
    plotLineId: string;
    event: PlotEvent;
  } | null>(null);

  const saveEdit = () => {
    if (!editing) return;
    updateEvent(editing.plotLineId, editing.event, { immediate: true });
    setEditing(null);
  };

  return (
    <div className="h-full flex flex-col bg-ns-surface">
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-ns-border">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-ns-ink-muted">
          Plan for this chapter
        </p>
        <p
          className="font-ui text-xs text-ns-ink-secondary mt-0.5"
          aria-live="polite"
        >
          {query.isPending ? "Loading…" : planSummary(plan)}
        </p>
        {ASSISTANT_UI_ENABLED && chapter && (
          <button
            type="button"
            className={`${actionClass} mt-1.5 -ml-2`}
            onClick={() =>
              openAssistantWith({
                storyId,
                prompt: developChapterPrompt(chapter),
              })
            }
          >
            <Sparkles className="w-3 h-3" aria-hidden />
            Develop this chapter’s plan
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {!query.isPending && plan.length === 0 && (
          <div className="flex flex-col items-center text-center gap-2 px-4 py-10">
            <Layers className="w-6 h-6 text-ns-ink-muted" aria-hidden />
            <p className="font-ui text-sm text-ns-ink-secondary">
              No events planned for this chapter.
            </p>
            <button
              type="button"
              onClick={() => navigate(plotEventPath(storyId))}
              className="font-ui text-xs font-medium text-ns-accent hover:underline"
            >
              Open Plot
            </button>
          </div>
        )}

        {plan.map(({ line, event }) => (
          <article
            key={event.id}
            aria-label={event.name || "Untitled event"}
            className="rounded-ns-lg border border-ns-border bg-ns-elevated p-3 space-y-2.5"
          >
            <EventSummary
              event={event}
              context={line.name}
              characters={characters}
              places={places}
            />
            <EventStatusControl
              size="sm"
              value={event.status}
              label={`Status of ${event.name || "this event"}`}
              onChange={(status) => updateEvent(line.id, { ...event, status })}
            />
            <div className="flex items-center gap-1 -ml-2">
              <button
                type="button"
                className={actionClass}
                onClick={() =>
                  setEditing({ plotLineId: line.id, event: { ...event } })
                }
              >
                <Pencil className="w-3 h-3" aria-hidden />
                Edit
              </button>
              <button
                type="button"
                className={actionClass}
                onClick={() =>
                  navigate(plotEventPath(storyId, line.id, event.id))
                }
              >
                <ArrowUpRight className="w-3 h-3" aria-hidden />
                Open in Plot
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Portalled so the dialog isn't confined to the mobile slide-over's z-40 layer. */}
      {createPortal(
        <EventEditModal
          isOpen={editing !== null}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          editingEvent={editing}
          setEditingEvent={setEditing}
          characters={characters}
          places={places}
          chapters={options}
        />,
        document.body,
      )}
    </div>
  );
};
