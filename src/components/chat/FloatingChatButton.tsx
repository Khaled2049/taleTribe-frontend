import React, { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { ASSISTANT_UI_ENABLED } from "@/config/featureFlags";

const AssistantPanel = lazy(() => import("./AssistantPanel"));

interface FloatingChatButtonProps {
  storyId?: string;
}

/**
 * Mounts the story assistant for the current story.
 *
 * The panel owns its own trigger and open state, so this is only a placement
 * and story-resolution boundary. It belongs to the mounted story workspace
 * rather than the editor, so closing the dialog or switching tabs preserves
 * the settled messages of the current story.
 */
export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  storyId: propStoryId,
}) => {
  const { storyId, id } = useParams<{ storyId?: string; id?: string }>();
  const currentStoryId = propStoryId || storyId || id;

  if (!currentStoryId || !ASSISTANT_UI_ENABLED) return null;

  return (
    <Suspense
      fallback={
        <div className="fixed bottom-24 right-4 z-30 h-11 w-11 animate-pulse rounded-full bg-ns-surface motion-reduce:animate-none md:right-6" />
      }
    >
      <AssistantPanel key={currentStoryId} storyId={currentStoryId} />
    </Suspense>
  );
};
