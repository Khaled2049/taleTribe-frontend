import { ASSISTANT_UI_ENABLED } from "@/config/featureFlags";
import {
  initialDockOpen,
  initialDockWidth,
} from "@/components/chat/assistantDock";

const bar =
  "rounded bg-ns-ink opacity-10 animate-pulse motion-reduce:animate-none";
const PARAGRAPHS = [5, 4, 6, 3, 5];
const CHAPTER_ROWS = ["w-3/5", "w-2/5", "w-3/5", "w-2/5"];
const NAV_ROWS = 4;

export function EditorCanvasSkeleton() {
  return (
    <div
      className="flex flex-1 h-full min-w-0 overflow-hidden"
      role="status"
      aria-label="Opening your story"
    >
      <div
        aria-hidden
        className="hidden lg:flex w-80 flex-shrink-0 flex-col bg-ns-surface border-r border-ns-border"
      >
        <div className="px-4 pt-5 pb-4 space-y-3 border-b border-ns-border">
          <div className={`${bar} h-6 w-3/5`} />
          <div className={`${bar} h-4 w-2/5`} />
        </div>
        <div className="px-4 pt-5 pb-3">
          <div className={`${bar} h-3 w-1/4`} />
        </div>
        <div className="px-2">
          {CHAPTER_ROWS.map((width, row) => (
            <div key={row} className="flex h-9 items-center px-7">
              <div className={`${bar} h-4 ${width}`} />
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center justify-between border-b border-ns-border bg-ns-surface px-3 py-2 gap-2">
          <div className={`${bar} h-3 w-1/3`} />
          <div className="flex items-center gap-1.5">
            <div className={`${bar} h-6 w-20`} />
            <div className={`${bar} h-6 w-16`} />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-ns-elevated">
          <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-10 lg:px-16 space-y-6">
            {PARAGRAPHS.map((lines, paragraph) => (
              <div key={paragraph} className="space-y-3">
                {Array.from({ length: lines }, (_, line) => (
                  <div
                    key={line}
                    className={`${bar} h-4 ${line === lines - 1 ? "w-2/3" : "w-full"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex flex-shrink-0 items-center gap-1.5 border-t border-ns-border bg-ns-surface px-4 py-2">
          <div className={`${bar} h-7 w-20`} />
          <div className={`${bar} h-7 w-24`} />
          <div className={`${bar} h-7 w-16 ml-auto`} />
        </div>

        <div className="sm:hidden flex-shrink-0 space-y-2 border-t border-ns-border bg-ns-surface px-3 py-2">
          <div className={`${bar} mx-auto h-3 w-24`} />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, button) => (
              <div key={button} className={`${bar} h-7`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditorWorkspaceSkeleton() {
  const dockWidth = ASSISTANT_UI_ENABLED
    ? initialDockOpen()
      ? initialDockWidth()
      : 48
    : 0;

  return (
    <div className="flex h-full bg-ns-bg overflow-hidden">
      <div
        aria-hidden
        className="hidden lg:flex w-44 flex-shrink-0 flex-col gap-0.5 bg-ns-surface border-r border-ns-border pt-4 pb-4 px-2"
      >
        <div className="flex h-10 items-center px-3">
          <div className={`${bar} h-4 w-24`} />
        </div>
        <div className="my-1.5 mx-3 h-px bg-ns-border" />
        {Array.from({ length: NAV_ROWS }, (_, row) => (
          <div key={row} className="flex h-10 items-center px-3">
            <div className={`${bar} h-4 w-20`} />
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
        <div
          aria-hidden
          className="lg:hidden flex items-center gap-2 border-b border-ns-border bg-ns-surface px-3 py-2"
        >
          {Array.from({ length: NAV_ROWS }, (_, tab) => (
            <div key={tab} className={`${bar} h-6 w-16`} />
          ))}
        </div>
        <div className="flex-1 min-h-0 flex">
          <EditorCanvasSkeleton />
        </div>
      </div>

      {dockWidth > 0 && (
        <div
          aria-hidden
          className="hidden lg:block h-full flex-shrink-0 border-l border-ns-border bg-ns-surface"
          style={{ width: `${dockWidth}px` }}
        />
      )}
    </div>
  );
}
