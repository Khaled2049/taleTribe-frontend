import type { ProposeEditorEditArgs } from "@novelsync/assistant-contracts";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AssistantProposalPreview = {
  key: string;
  proposal: ProposeEditorEditArgs;
  canApply: boolean;
  busy: boolean;
  apply: () => void;
  reject: () => void;
  askForRevision: () => void;
};

type AssistantProposalContextValue = {
  preview: AssistantProposalPreview | null;
  present: (preview: AssistantProposalPreview) => void;
  clear: (key: string) => void;
};

const AssistantProposalContext =
  createContext<AssistantProposalContextValue | null>(null);

export function AssistantProposalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<AssistantProposalPreview | null>(null);

  const present = useCallback((next: AssistantProposalPreview) => {
    setPreview((current) => {
      if (
        current?.key === next.key &&
        current.proposal === next.proposal &&
        current.canApply === next.canApply &&
        current.busy === next.busy &&
        current.apply === next.apply &&
        current.reject === next.reject &&
        current.askForRevision === next.askForRevision
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const clear = useCallback((key: string) => {
    setPreview((current) => (current?.key === key ? null : current));
  }, []);

  const value = useMemo(
    () => ({ preview, present, clear }),
    [clear, present, preview],
  );

  return (
    <AssistantProposalContext.Provider value={value}>
      {children}
    </AssistantProposalContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAssistantProposal() {
  return useContext(AssistantProposalContext);
}
