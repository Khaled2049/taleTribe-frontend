import React, { lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Chatbot } from "./Chatbot";
import { useParams } from "react-router-dom";
import {
  ASSISTANT_UI_ENABLED,
  ASSISTANT_LEGACY_FALLBACK_ENABLED,
} from "@/config/featureFlags";

const AssistantPanel = lazy(() => import("./AssistantPanel"));

interface FloatingChatButtonProps {
  storyId?: string;
  scope?: "editor" | "workspace";
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  storyId: propStoryId,
  scope = "editor",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { storyId, id } = useParams<{ storyId?: string; id?: string }>();

  // Use prop storyId if provided, otherwise fall back to route params
  const currentStoryId = propStoryId || storyId || id;

  // Don't show if no story context
  if (!currentStoryId) return null;
  if (!ASSISTANT_UI_ENABLED && !ASSISTANT_LEGACY_FALLBACK_ENABLED) return null;

  // The product runtime belongs to the mounted story workspace so closing the
  // dialog or changing tabs preserves settled local messages. The legacy
  // fallback remains editor-scoped exactly as before.
  if (scope === "workspace") {
    if (!ASSISTANT_UI_ENABLED) return null;
    return (
      <Suspense
        fallback={
          <div className="fixed bottom-24 right-4 z-30 h-11 w-11 animate-pulse rounded-full bg-ns-surface motion-reduce:animate-none md:right-6" />
        }
      >
        <AssistantPanel key={currentStoryId} storyId={currentStoryId} />
      </Suspense>
    );
  }

  if (ASSISTANT_UI_ENABLED || !ASSISTANT_LEGACY_FALLBACK_ENABLED) return null;

  return (
    <>
      {/* Fixed FAB trigger */}
      <button
        onClick={() => setIsOpen(true)}
        data-cy="open-chat"
        className={`fixed bottom-24 right-4 md:bottom-24 md:right-6 z-30 w-11 h-11 rounded-full bg-ns-accent text-white shadow-ns-lg hover:bg-ns-accent-hover active:scale-95 transition-all duration-200 flex items-center justify-center ${
          isOpen
            ? "opacity-0 pointer-events-none scale-90"
            : "opacity-100 scale-100"
        }`}
        aria-label="Open AI Assistant"
        title="AI Assistant"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Sliding Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Legacy Chat Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 z-50 shadow-ns-xl animate-ns-slide-up">
            <Chatbot
              storyId={currentStoryId}
              onClose={() => setIsOpen(false)}
              mode="floating"
            />
          </div>
        </>
      )}
    </>
  );
};
