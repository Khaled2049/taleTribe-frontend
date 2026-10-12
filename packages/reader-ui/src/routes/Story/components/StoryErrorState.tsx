import React from "react";
import { AlertCircle } from "lucide-react";

interface StoryErrorStateProps {
  error: string | null;
  onRetry: () => void;
}

export const StoryErrorState: React.FC<StoryErrorStateProps> = ({
  error,
  onRetry,
}) => {
  return (
    <div className="min-h-screen bg-ns-bg flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-4 animate-ns-fade-in">
        <div className="w-14 h-14 rounded-full bg-ns-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-ns-destructive" />
        </div>
        <div className="space-y-1">
          <p className="font-heading italic text-xl text-ns-ink-secondary">
            {error || "Story not found"}
          </p>
          <p className="font-ui text-xs text-ns-ink-muted">
            Something went wrong loading this story.
          </p>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-ns-accent text-white font-ui text-sm rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};
