export type AssistantTab = "chat" | "history";

const TABS: { id: AssistantTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "history", label: "History" },
];

export function AssistantTabs({
  value,
  onChange,
}: {
  value: AssistantTab;
  onChange: (tab: AssistantTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Assistant views"
      className="mt-2.5 flex gap-0.5 rounded-ns-lg border border-ns-border bg-ns-bg p-0.5"
    >
      {TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-cy={`assistant-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-ns px-3 py-1.5 font-ui text-[11px] font-semibold tracking-wide transition-colors duration-200 motion-reduce:transition-none ${
              active
                ? "bg-ns-elevated text-ns-ink shadow-ns-sm"
                : "text-ns-ink-muted hover:text-ns-ink-secondary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
