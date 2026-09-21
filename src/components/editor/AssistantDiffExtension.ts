import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ProposeEditorEditArgs } from "@novelsync/assistant-contracts";

export const assistantDiffPluginKey = new PluginKey<DecorationSet>(
  "assistantDiffPreview",
);
export const assistantSelectionPluginKey = new PluginKey<DecorationSet>(
  "assistantRetainedSelection",
);

export type AssistantRetainedSelection = {
  from: number;
  to: number;
};

function proposalDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  proposal: ProposeEditorEditArgs | null,
) {
  if (!proposal || proposal.operations.length !== 1) {
    return DecorationSet.empty;
  }
  const operation = proposal.operations[0];
  if (operation.type !== "replace" || operation.from >= operation.to) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [
    Decoration.inline(operation.from, operation.to, {
      class: "assistant-diff-removed",
      "data-assistant-change": "removed",
      title: "The assistant proposes removing this text",
    }),
  ];

  decorations.push(
    Decoration.widget(
      operation.to,
      () => {
        const wrapper = document.createElement("span");
        wrapper.className = "assistant-diff-added";
        wrapper.dataset.assistantChange = "added";
        wrapper.contentEditable = "false";
        wrapper.setAttribute(
          "aria-label",
          operation.replacementText
            ? `Suggested replacement: ${operation.replacementText}`
            : "Suggested deletion",
        );

        const label = document.createElement("span");
        label.className = "assistant-diff-label";
        label.textContent = operation.replacementText ? "Suggested" : "Delete";
        wrapper.append(label);

        if (operation.replacementText) {
          wrapper.append(document.createTextNode(operation.replacementText));
        }
        return wrapper;
      },
      { key: "assistant-diff-added", side: 1 },
    ),
  );

  return DecorationSet.create(doc, decorations);
}

export function createAssistantDiffPlugin() {
  return new Plugin({
    key: assistantDiffPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, current) {
        const proposal = transaction.getMeta(assistantDiffPluginKey) as
          ProposeEditorEditArgs | null | undefined;
        if (proposal !== undefined) {
          return proposalDecorations(transaction.doc, proposal);
        }
        return current.map(transaction.mapping, transaction.doc);
      },
    },
    props: {
      decorations(state) {
        return assistantDiffPluginKey.getState(state) ?? DecorationSet.empty;
      },
    },
  });
}

export function createAssistantSelectionPlugin() {
  return new Plugin({
    key: assistantSelectionPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(transaction, current) {
        const selection = transaction.getMeta(assistantSelectionPluginKey) as
          AssistantRetainedSelection | null | undefined;
        if (selection !== undefined) {
          if (
            !selection ||
            selection.from >= selection.to ||
            selection.from < 0 ||
            selection.to > transaction.doc.content.size
          ) {
            return DecorationSet.empty;
          }
          return DecorationSet.create(transaction.doc, [
            Decoration.inline(selection.from, selection.to, {
              class: "assistant-selection-retained",
              "data-assistant-selection": "retained",
              title: "Selected text shared with the story assistant",
            }),
          ]);
        }
        if (transaction.docChanged) return DecorationSet.empty;
        return current.map(transaction.mapping, transaction.doc);
      },
    },
    props: {
      decorations(state) {
        return (
          assistantSelectionPluginKey.getState(state) ?? DecorationSet.empty
        );
      },
    },
  });
}

export const AssistantDiffExtension = Extension.create({
  name: "assistantDiffPreview",

  addProseMirrorPlugins() {
    return [createAssistantDiffPlugin(), createAssistantSelectionPlugin()];
  },
});
