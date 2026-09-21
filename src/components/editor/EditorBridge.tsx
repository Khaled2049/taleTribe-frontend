import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import {
  type EditorApplyResult,
  type EditorContext as AssistantEditorContext,
  type ProposeEditorEditArgs,
} from "@novelsync/assistant-contracts";
import { StoryDataConflictError } from "@novelsync/story-data-client";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const EDITOR_WINDOW_CHARS = 8_000;

export type ProposalCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_editor"
        | "wrong_story"
        | "wrong_chapter"
        | "stale_revision"
        | "stale_document"
        | "unsupported_operation"
        | "invalid_range"
        | "changed_text"
        | "unsupported_selection"
        | "unsupported_replacement";
    };

type EditorSession = {
  storyId: string;
  chapterId: string;
  editor: Editor;
  getChapterTitle: () => string;
  getPersistedRevision: () => number | undefined;
  getDirty: () => boolean;
  flushAndWait: () => Promise<number | undefined>;
  documentVersion: number;
  lastSelection: {
    from: number;
    to: number;
    text: string;
  } | null;
  savedDocumentVersion: number | null;
  savedRevision: number | undefined;
};

function markSaved(session: EditorSession, revision: number | undefined) {
  session.savedDocumentVersion = session.documentVersion;
  if (revision !== undefined) session.savedRevision = revision;
}

function sessionDirty(session: EditorSession) {
  if (session.savedDocumentVersion === session.documentVersion) return false;
  return session.getDirty();
}

function sessionRevision(session: EditorSession) {
  const fromState = session.getPersistedRevision();
  if (session.savedRevision === undefined) return fromState ?? null;
  if (fromState === undefined) return session.savedRevision;
  return Math.max(fromState, session.savedRevision);
}

function selectedText(editor: Editor, from: number, to: number): string {
  return editor.state.doc.textBetween(from, to, "\n\n", "\ufffc");
}

function isSupportedSelection(editor: Editor, from: number, to: number) {
  if (from >= to || from < 0 || to > editor.state.doc.content.size)
    return false;
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return false;
  let supported = true;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isAtom && !node.isText) supported = false;
  });
  return supported;
}

function editorWindow(editor: Editor, selectionText: string | null) {
  const text = editor.getText({ blockSeparator: "\n\n" });
  if (text.length <= EDITOR_WINDOW_CHARS) {
    return { text, truncated: false };
  }
  const anchor = selectionText ? Math.max(0, text.indexOf(selectionText)) : 0;
  const start = Math.min(
    Math.max(0, anchor - Math.floor(EDITOR_WINDOW_CHARS / 2)),
    text.length - EDITOR_WINDOW_CHARS,
  );
  return {
    text: text.slice(start, start + EDITOR_WINDOW_CHARS),
    truncated: true,
  };
}

function retainedSelection(session: EditorSession) {
  const { from, to } = session.editor.state.selection;
  const selectionEligible = isSupportedSelection(session.editor, from, to);
  const currentText = selectionEligible
    ? selectedText(session.editor, from, to)
    : "";
  if (selectionEligible && currentText) {
    session.lastSelection = { from, to, text: currentText };
    return session.lastSelection;
  }

  const retained = session.lastSelection;
  if (
    retained &&
    isSupportedSelection(session.editor, retained.from, retained.to) &&
    selectedText(session.editor, retained.from, retained.to) === retained.text
  ) {
    return retained;
  }
  session.lastSelection = null;
  return null;
}

function snapshot(session: EditorSession): AssistantEditorContext {
  const selection = retainedSelection(session);
  return {
    chapterId: session.chapterId,
    persistedRevision: sessionRevision(session),
    documentVersion: session.documentVersion,
    selection,
    buffer: editorWindow(session.editor, selection?.text ?? null),
    dirty: sessionDirty(session),
  };
}

export class EditorBridgeStore {
  private active: EditorSession | null = null;
  private version = 0;
  private readonly listeners = new Set<() => void>();

  constructor(readonly storyId: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private emit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  register(
    session: Omit<
      EditorSession,
      | "documentVersion"
      | "lastSelection"
      | "savedDocumentVersion"
      | "savedRevision"
    >,
  ) {
    const registered: EditorSession = {
      ...session,
      documentVersion: 0,
      lastSelection: null,
      savedDocumentVersion: null,
      savedRevision: undefined,
    };
    retainedSelection(registered);
    this.active = registered;
    this.emit();
    return {
      transaction: (transaction: Transaction) => {
        if (this.active !== registered) return;
        if (transaction.docChanged) {
          registered.documentVersion += 1;
          registered.lastSelection = null;
        }
        retainedSelection(registered);
        this.emit();
      },
      revisionChanged: () => {
        if (this.active === registered) this.emit();
      },
      unregister: () => {
        if (this.active !== registered) return;
        this.active = null;
        this.emit();
      },
    };
  }

  getSnapshot(): AssistantEditorContext | null {
    if (!this.active || this.active.storyId !== this.storyId) return null;
    return snapshot(this.active);
  }

  getActiveChapterTitle(): string | null {
    return this.active?.getChapterTitle() ?? null;
  }

  async prepareSnapshot(): Promise<AssistantEditorContext | null> {
    const active = this.active;
    if (!active || active.storyId !== this.storyId) return null;
    if (sessionDirty(active)) {
      try {
        const revision = await active.flushAndWait();
        if (this.active === active) {
          markSaved(active, revision);
          this.emit();
        }
      } catch {
        // A dirty snapshot remains useful to read. Agents refuses to turn it
        // into an applicable proposal until saving succeeds.
      }
    }
    return this.active === active ? snapshot(active) : null;
  }

  inspectProposal(proposal: ProposeEditorEditArgs): ProposalCheck {
    const active = this.active;
    if (!active) return { ok: false, reason: "no_editor" };
    if (active.storyId !== this.storyId)
      return { ok: false, reason: "wrong_story" };
    if (proposal.chapterId !== active.chapterId)
      return { ok: false, reason: "wrong_chapter" };
    const current = snapshot(active);
    if (proposal.baseRevision !== current.persistedRevision)
      return { ok: false, reason: "stale_revision" };
    if (proposal.baseDocumentVersion !== current.documentVersion)
      return { ok: false, reason: "stale_document" };
    if (proposal.operations.length !== 1)
      return { ok: false, reason: "unsupported_operation" };
    const operation = proposal.operations[0];
    if (operation.type !== "replace")
      return { ok: false, reason: "unsupported_operation" };
    if (!isSupportedSelection(active.editor, operation.from, operation.to))
      return { ok: false, reason: "unsupported_selection" };
    if (operation.from >= operation.to)
      return { ok: false, reason: "invalid_range" };
    if (/\r|\n/.test(operation.replacementText ?? ""))
      return { ok: false, reason: "unsupported_replacement" };
    if (
      selectedText(active.editor, operation.from, operation.to) !==
      operation.originalText
    ) {
      return { ok: false, reason: "changed_text" };
    }
    return { ok: true };
  }

  async applyProposal(
    proposal: ProposeEditorEditArgs,
  ): Promise<EditorApplyResult> {
    const active = this.active;
    const check = this.inspectProposal(proposal);
    if (!active || !check.ok) {
      return {
        status:
          !check.ok && check.reason.startsWith("stale") ? "stale" : "invalid",
        chapterId: proposal.chapterId,
        documentVersion: active?.documentVersion ?? 0,
        persistedRevision: active ? sessionRevision(active) : null,
      };
    }

    const operation = proposal.operations[0];
    if (operation.type !== "replace") {
      return {
        status: "invalid",
        chapterId: proposal.chapterId,
        documentVersion: active.documentVersion,
        persistedRevision: sessionRevision(active),
      };
    }
    const before = active.editor.state.doc;
    const transaction = active.editor.state.tr
      .insertText(operation.replacementText ?? "", operation.from, operation.to)
      .setMeta("assistant-approved-edit", true)
      .setMeta("addToHistory", true);
    active.editor.view.dispatch(transaction);
    if (active.editor.state.doc.eq(before)) {
      return {
        status: "invalid",
        chapterId: proposal.chapterId,
        documentVersion: active.documentVersion,
        persistedRevision: sessionRevision(active),
      };
    }

    try {
      const persistedRevision = await active.flushAndWait();
      if (this.active === active) markSaved(active, persistedRevision);
      return {
        status: "saved",
        chapterId: active.chapterId,
        documentVersion: active.documentVersion,
        persistedRevision: persistedRevision ?? sessionRevision(active),
      };
    } catch (error) {
      return {
        status:
          error instanceof StoryDataConflictError
            ? "applied_local_save_conflict"
            : "applied_local_save_failed",
        chapterId: active.chapterId,
        documentVersion: active.documentVersion,
        persistedRevision: sessionRevision(active),
      };
    }
  }
}

const EditorBridgeContext = createContext<EditorBridgeStore | null>(null);

export function EditorBridgeProvider({
  storyId,
  children,
}: {
  storyId: string;
  children: ReactNode;
}) {
  const bridge = useMemo(() => new EditorBridgeStore(storyId), [storyId]);
  return (
    <EditorBridgeContext.Provider value={bridge}>
      {children}
    </EditorBridgeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorBridge() {
  return useContext(EditorBridgeContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorBridgeSnapshot() {
  const bridge = useEditorBridge();
  useSyncExternalStore(
    bridge?.subscribe ?? (() => () => undefined),
    bridge?.getVersion ?? (() => 0),
    bridge?.getVersion ?? (() => 0),
  );
  return bridge?.getSnapshot() ?? null;
}
