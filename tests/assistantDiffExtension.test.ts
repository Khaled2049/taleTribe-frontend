import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import {
  assistantDiffPluginKey,
  assistantSelectionPluginKey,
  createAssistantDiffPlugin,
  createAssistantSelectionPlugin,
} from "@/components/editor/AssistantDiffExtension";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
  },
});

function stateWithSelectionPlugin(text: string) {
  return EditorState.create({
    doc: schema.node("doc", null, [
      schema.node("paragraph", null, schema.text(text)),
    ]),
    plugins: [createAssistantSelectionPlugin()],
  });
}

function stateWithText(text: string) {
  return EditorState.create({
    doc: schema.node("doc", null, [
      schema.node("paragraph", null, schema.text(text)),
    ]),
    plugins: [createAssistantDiffPlugin()],
  });
}

describe("assistant manuscript diff decorations", () => {
  it("shows removal and insertion decorations without changing the document", () => {
    const initial = stateWithText("Brass polish.");
    const next = initial.apply(
      initial.tr.setMeta(assistantDiffPluginKey, {
        chapterId: "chapter-1",
        baseRevision: 3,
        baseDocumentVersion: 0,
        summary: "Tighten the line",
        operations: [
          {
            type: "replace",
            from: 1,
            to: 14,
            originalText: "Brass polish.",
            replacementText: "Polished brass.",
          },
        ],
      }),
    );

    expect(next.doc.textContent).toBe("Brass polish.");
    const decorations = assistantDiffPluginKey.getState(next)?.find() ?? [];
    expect(decorations).toHaveLength(2);
    expect(
      decorations.some((decoration) => decoration.from < decoration.to),
    ).toBe(true);
    expect(
      decorations.some((decoration) => decoration.from === decoration.to),
    ).toBe(true);
  });

  it("clears the preview without changing the document", () => {
    let state = stateWithText("Brass polish.");
    state = state.apply(
      state.tr.setMeta(assistantDiffPluginKey, {
        chapterId: "chapter-1",
        baseRevision: 3,
        baseDocumentVersion: 0,
        summary: "Delete the line",
        operations: [
          {
            type: "replace",
            from: 1,
            to: 14,
            originalText: "Brass polish.",
            replacementText: "",
          },
        ],
      }),
    );
    state = state.apply(state.tr.setMeta(assistantDiffPluginKey, null));

    expect(assistantDiffPluginKey.getState(state)?.find()).toHaveLength(0);
    expect(state.doc.textContent).toBe("Brass polish.");
  });
});

describe("retained assistant selection decoration", () => {
  it("keeps a selected range visible without changing the document", () => {
    const initial = stateWithSelectionPlugin("Hello brave world");
    const next = initial.apply(
      initial.tr.setMeta(assistantSelectionPluginKey, { from: 7, to: 12 }),
    );

    expect(next.doc.textContent).toBe("Hello brave world");
    expect(assistantSelectionPluginKey.getState(next)?.find()).toHaveLength(1);
  });

  it("clears a retained selection when the document changes", () => {
    let state = stateWithSelectionPlugin("Hello brave world");
    state = state.apply(
      state.tr.setMeta(assistantSelectionPluginKey, { from: 7, to: 12 }),
    );
    state = state.apply(state.tr.insertText("Suddenly, ", 1));

    expect(assistantSelectionPluginKey.getState(state)?.find()).toHaveLength(0);
  });
});
