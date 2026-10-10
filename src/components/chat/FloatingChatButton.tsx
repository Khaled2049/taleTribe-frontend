import React, {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useMatch, useParams } from "react-router-dom";
import { ASSISTANT_UI_ENABLED } from "@/config/featureFlags";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useEditorBridge } from "@/components/editor/EditorBridge";
import { sidebarShortcut } from "@/lib/sidebarShortcut";
import {
  ASSISTANT_DOCK_OPEN_KEY,
  assistantWanted,
  initialDockOpen,
  initialDockWidth,
} from "./assistantDock";
import {
  AssistantDockPlaceholder,
  AssistantFab,
  AssistantRail,
} from "./AssistantDockParts";

const AssistantPanel = lazy(() => import("./AssistantPanel"));

// If the editor never registers (a failed load), stop holding the dock back.
const EDITOR_WAIT_MS = 5000;

const noopSubscribe = () => () => undefined;

interface FloatingChatButtonProps {
  storyId?: string;
}

/**
 * Renders the closed assistant and mounts the panel on first use.
 *
 * It belongs to the mounted story workspace rather than the editor, so once
 * mounted the panel keeps the current story's runtime while writers move
 * between workspace tabs or close it.
 */
export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  storyId: propStoryId,
}) => {
  const { storyId, id } = useParams<{ storyId?: string; id?: string }>();
  const currentStoryId = propStoryId || storyId || id;
  const { isLgUp } = useBreakpoint();
  const [desktopOpen, setDesktopOpen] = useState(initialDockOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openedByWriter, setOpenedByWriter] = useState(false);
  const [dockWidth] = useState(initialDockWidth);

  const bridge = useEditorBridge();
  const editorReady = useSyncExternalStore(
    bridge?.subscribe ?? noopSubscribe,
    () => bridge?.isActive() ?? false,
  );
  const onEditorRoute = useMatch("/create/:storyId") !== null;
  const [waitExpired, setWaitExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitExpired(true), EDITOR_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const wanted = assistantWanted({
    isLgUp,
    desktopOpen,
    mobileOpen,
    openedByWriter,
    onEditorRoute,
    editorReady,
    waitExpired,
  });
  const [mounted, setMounted] = useState(wanted);
  useEffect(() => {
    if (wanted) setMounted(true);
  }, [wanted]);

  useEffect(() => {
    window.localStorage.setItem(ASSISTANT_DOCK_OPEN_KEY, String(desktopOpen));
  }, [desktopOpen]);

  const available = Boolean(currentStoryId) && ASSISTANT_UI_ENABLED;
  useEffect(() => {
    if (!available) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (sidebarShortcut(event) !== "right") return;
      event.preventDefault();
      if (isLgUp) {
        setOpenedByWriter(true);
        setDesktopOpen((open) => !open);
      } else {
        setMobileOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [available, isLgUp]);

  if (!currentStoryId || !ASSISTANT_UI_ENABLED) return null;

  if (!(mounted || wanted)) {
    if (!isLgUp) return <AssistantFab onClick={() => setMobileOpen(true)} />;
    return desktopOpen ? (
      <AssistantDockPlaceholder width={dockWidth} />
    ) : (
      <AssistantRail
        onOpen={() => {
          setOpenedByWriter(true);
          setDesktopOpen(true);
        }}
      />
    );
  }

  return (
    <Suspense
      fallback={
        isLgUp ? (
          <AssistantDockPlaceholder width={dockWidth} />
        ) : (
          <div className="fixed bottom-24 right-4 z-30 h-11 w-11 animate-pulse rounded-full bg-ns-surface motion-reduce:animate-none md:right-6" />
        )
      }
    >
      <AssistantPanel
        key={currentStoryId}
        storyId={currentStoryId}
        desktopOpen={desktopOpen}
        setDesktopOpen={setDesktopOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        restored={isLgUp && !openedByWriter}
      />
    </Suspense>
  );
};
