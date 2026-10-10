import { useEditorState, type Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  canSplitDocument,
  getDocumentOutline,
  type OutlineEntry,
} from "@/utils/documentOutline";

// Each hook re-renders its caller only when its selected value changes, so
// ordinary typing does not re-render the editor page.
//
// Selectors read the `editor` argument, not the snapshot's: when the editor
// goes from null to an instance, TipTap's state manager keeps serving its
// cached null-editor snapshot until the next transaction.

export type TextAlign = "left" | "center" | "right" | "justify";

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  link: boolean;
  paragraph: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  textAlign: TextAlign;
  fontFamily: string | null;
  fontSize: string | null;
  color: string | null;
  highlightColor: string | null;
  lineHeight: string | null;
  paragraphSpacing: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

const NO_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  link: false,
  paragraph: false,
  heading1: false,
  heading2: false,
  heading3: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  textAlign: "left",
  fontFamily: null,
  fontSize: null,
  color: null,
  highlightColor: null,
  lineHeight: null,
  paragraphSpacing: null,
  canUndo: false,
  canRedo: false,
};

export function useFormatState(editor: Editor | null): FormatState {
  return (
    useEditorState({
      editor,
      selector: () => {
        const current = editor;
        if (!current) return NO_FORMAT;
        const textStyle = current.getAttributes("textStyle");
        const block = current.state.selection.$from.parent.attrs;
        return {
          bold: current.isActive("bold"),
          italic: current.isActive("italic"),
          underline: current.isActive("underline"),
          strike: current.isActive("strike"),
          link: current.isActive("link"),
          paragraph: current.isActive("paragraph"),
          heading1: current.isActive("heading", { level: 1 }),
          heading2: current.isActive("heading", { level: 2 }),
          heading3: current.isActive("heading", { level: 3 }),
          bulletList: current.isActive("bulletList"),
          orderedList: current.isActive("orderedList"),
          blockquote: current.isActive("blockquote"),
          textAlign: current.isActive({ textAlign: "center" })
            ? "center"
            : current.isActive({ textAlign: "right" })
              ? "right"
              : current.isActive({ textAlign: "justify" })
                ? "justify"
                : "left",
          fontFamily: textStyle.fontFamily ?? null,
          fontSize: textStyle.fontSize ?? null,
          color: textStyle.color ?? null,
          highlightColor: textStyle.backgroundColor ?? null,
          lineHeight: block.lineHeight ?? null,
          paragraphSpacing: block.paragraphSpacing ?? null,
          canUndo: current.can().undo(),
          canRedo: current.can().redo(),
        };
      },
    }) ?? NO_FORMAT
  );
}

export interface DocumentStructure {
  outline: OutlineEntry[];
  canSplit: boolean;
}

const EMPTY_STRUCTURE: DocumentStructure = { outline: [], canSplit: false };
const structureCache = new WeakMap<ProseMirrorNode, DocumentStructure>();

/**
 * Heading positions shift with every keystroke above them, so positions are
 * left out of the comparison; callers look the live position up on use.
 */
export function sameStructure(
  a: DocumentStructure,
  b: DocumentStructure | null,
): boolean {
  if (!b) return false;
  return (
    a.canSplit === b.canSplit &&
    a.outline.length === b.outline.length &&
    a.outline.every(
      (entry, i) =>
        entry.level === b.outline[i].level && entry.text === b.outline[i].text,
    )
  );
}

export function useDocumentStructure(
  editor: Editor | null,
  enabled: boolean,
): DocumentStructure {
  return (
    useEditorState({
      editor,
      selector: () => {
        const current = editor;
        if (!enabled || !current) return EMPTY_STRUCTURE;
        const doc = current.state.doc;
        let structure = structureCache.get(doc);
        if (!structure) {
          structure = {
            outline: getDocumentOutline(current),
            canSplit: canSplitDocument(current),
          };
          structureCache.set(doc, structure);
        }
        return structure;
      },
      equalityFn: sameStructure,
    }) ?? EMPTY_STRUCTURE
  );
}
