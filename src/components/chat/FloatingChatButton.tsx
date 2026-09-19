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
 * The assistant owns its responsive dock/dialog state, so this remains a
 * placement and story-resolution boundary. It belongs to the mounted story
 * workspace rather than the editor, preserving the current story's runtime
 * while writers move between workspace tabs.
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
        <div className="fixed bottom-24 right-4 z-30 h-11 w-11 animate-pulse rounded-full bg-ns-surface motion-reduce:animate-none lg:static lg:h-full lg:w-[28rem] lg:shrink-0 lg:rounded-none lg:border-l lg:border-ns-border" />
      }
    >
      <AssistantPanel key={currentStoryId} storyId={currentStoryId} />
    </Suspense>
  );
};
