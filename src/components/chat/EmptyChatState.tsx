import React from "react";
import { Lightbulb, BookOpen, Zap, MessageSquare } from "lucide-react";

interface EmptyChatStateProps {
  onSuggestion?: (text: string) => void;
}

const suggestions = [
  { icon: Lightbulb, text: "Brainstorm plot twists for my story" },
  { icon: BookOpen, text: "Analyze my character development" },
  { icon: Zap, text: "Improve this paragraph's pacing" },
  { icon: MessageSquare, text: "What are the main themes?" },
];

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  onSuggestion,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 gap-6">
      <div>
        <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center mx-auto mb-3">
          <MessageSquare className="w-6 h-6 text-ns-accent" />
        </div>
        <h3 className="font-heading text-base text-ns-ink mb-1">
          Writing Assistant
        </h3>
        <p className="font-ui text-xs text-ns-ink-muted max-w-[200px] mx-auto">
          Ask anything about your story — I have full context.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => onSuggestion?.(s.text)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-ns-surface border border-ns-border text-left hover:bg-ns-surface-hover hover:border-ns-border-strong transition-colors group"
            >
              <Icon className="w-3.5 h-3.5 text-ns-accent flex-shrink-0" />
              <span className="font-ui text-xs text-ns-ink-secondary group-hover:text-ns-ink transition-colors">
                {s.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
