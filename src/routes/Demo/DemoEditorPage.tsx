import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { StoryWorkspaceTabs } from "../Story/components/StoryWorkspaceTabs";
import { useFocusModeStore } from "@/stores/focusModeStore";

const DemoEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const focusMode = useFocusModeStore((s) => s.focusMode);

  return (
    <DemoModeProvider>
      <div className="flex flex-col h-full bg-ns-bg">
        {/* Banner */}
        {!focusMode && (
          <div className="flex-shrink-0 bg-ns-accent/10 border-b border-ns-accent/20 px-4 py-2.5 text-center">
            <p className="font-ui text-sm text-ns-ink">
              You&rsquo;re exploring TheTaleTribe.{" "}
              <button
                onClick={() => navigate("/sign-in")}
                className="font-semibold text-ns-accent hover:text-ns-accent-hover underline underline-offset-2 transition-colors"
              >
                Sign in
              </button>{" "}
              to save, publish, and use AI writing tools.
            </p>
          </div>
        )}

        {!focusMode && <StoryWorkspaceTabs basePath="/try" />}

        {/* Active tab content */}
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </div>
    </DemoModeProvider>
  );
};

export default DemoEditorPage;
