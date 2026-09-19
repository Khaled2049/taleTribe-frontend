import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { EditorBridgeStore } from "@/components/editor/EditorBridge";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
  },
});

function fakeEditor(text: string, from = 1, to = 1) {
  const paragraph = schema.node(
    "paragraph",
    null,
    text ? schema.text(text) : undefined,
  );
  const doc = schema.node("doc", null, [paragraph]);
  let state = EditorState.create({
    doc,
    selection: TextSelection.create(doc, from, to),
  });
  let onTransaction: ((transaction: Transaction) => void) | undefined;
  const editor = {
    get state() {
      return state;
    },
    getText: () => state.doc.textContent,
    view: {
      dispatch(transaction: Transaction) {
        state = state.apply(transaction);
        onTransaction?.(transaction);
      },
    },
  } as unknown as Editor;
  return {
    editor,
    connect(listener: (transaction: Transaction) => void) {
      onTransaction = listener;
    },
    text: () => state.doc.textContent,
  };
}

describe("EditorBridgeStore", () => {
  it("captures a bounded selection snapshot and counts document transactions", () => {
    const fake = fakeEditor("Hello brave world", 7, 12);
    const bridge = new EditorBridgeStore("story-1");
    const registration = bridge.register({
      storyId: "story-1",
      chapterId: "chapter-1",
      editor: fake.editor,
      getChapterTitle: () => "Arrival",
      getPersistedRevision: () => 3,
      getDirty: () => false,
      flushAndWait: async () => 3,
    });
    fake.connect(registration.transaction);

    expect(bridge.getSnapshot()).toMatchObject({
      chapterId: "chapter-1",
      persistedRevision: 3,
      documentVersion: 0,
      selection: { from: 7, to: 12, text: "brave" },
      dirty: false,
    });
    fake.editor.view.dispatch(fake.editor.state.tr.insertText("bold", 7, 12));
    expect(bridge.getSnapshot()?.documentVersion).toBe(1);
    expect(bridge.getActiveChapterTitle()).toBe("Arrival");
  });

  it("retains a valid selection when focus collapses and clears it after an edit", () => {
    const fake = fakeEditor("Hello brave world", 7, 12);
    const bridge = new EditorBridgeStore("story-1");
    const registration = bridge.register({
      storyId: "story-1",
      chapterId: "chapter-1",
      editor: fake.editor,
      getChapterTitle: () => "Arrival",
      getPersistedRevision: () => 3,
      getDirty: () => false,
      flushAndWait: async () => 3,
    });
    fake.connect(registration.transaction);

    fake.editor.view.dispatch(
      fake.editor.state.tr.setSelection(
        TextSelection.create(fake.editor.state.doc, 1),
      ),
    );
    expect(bridge.getSnapshot()?.selection).toEqual({
      from: 7,
      to: 12,
      text: "brave",
    });

    fake.editor.view.dispatch(fake.editor.state.tr.insertText("Suddenly, ", 1));
    expect(bridge.getSnapshot()?.selection).toBeNull();
  });

  it("applies one exact replacement and waits for its guarded save", async () => {
    const fake = fakeEditor("Hello brave world", 7, 12);
    const bridge = new EditorBridgeStore("story-1");
    let revision = 3;
    const flushAndWait = vi.fn(async () => {
      revision = 4;
      return revision;
    });
    const registration = bridge.register({
      storyId: "story-1",
      chapterId: "chapter-1",
      editor: fake.editor,
      getChapterTitle: () => "Arrival",
      getPersistedRevision: () => revision,
      getDirty: () => false,
      flushAndWait,
    });
    fake.connect(registration.transaction);

    const result = await bridge.applyProposal({
      chapterId: "chapter-1",
      baseRevision: 3,
      baseDocumentVersion: 0,
      summary: "Tighten it",
      operations: [
        {
          type: "replace",
          from: 7,
          to: 12,
          originalText: "brave",
          replacementText: "bold",
        },
      ],
    });

    expect(fake.text()).toBe("Hello bold world");
    expect(flushAndWait).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "saved",
      chapterId: "chapter-1",
      documentVersion: 1,
      persistedRevision: 4,
    });
  });

  it("bounds the editor window and clears the exact registered session", () => {
    const fake = fakeEditor("x".repeat(9_000));
    const bridge = new EditorBridgeStore("story-1");
    const registration = bridge.register({
      storyId: "story-1",
      chapterId: "chapter-1",
      editor: fake.editor,
      getChapterTitle: () => "Long chapter",
      getPersistedRevision: () => 1,
      getDirty: () => false,
      flushAndWait: async () => 1,
    });
    expect(bridge.getSnapshot()?.buffer).toEqual({
      text: "x".repeat(8_000),
      truncated: true,
    });
    registration.unregister();
    expect(bridge.getSnapshot()).toBeNull();
  });
});
