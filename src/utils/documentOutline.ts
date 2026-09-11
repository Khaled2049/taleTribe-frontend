import { getHTMLFromFragment } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";

export interface OutlineEntry {
  pos: number;
  level: number;
  text: string;
}

export function getDocumentOutline(editor: Editor | null): OutlineEntry[] {
  if (!editor) return [];
  const entries: OutlineEntry[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== "heading") return;
    entries.push({
      pos: offset,
      level: Number(node.attrs.level) || 1,
      text: node.textContent.trim(),
    });
  });
  return entries;
}

export function jumpToOutlineEntry(editor: Editor, pos: number): void {
  editor
    .chain()
    .focus()
    .setTextSelection(pos + 1)
    .scrollIntoView()
    .run();
}

export function splitLevelFor(levels: number[]): number | null {
  return levels.length === 0 ? null : Math.min(...levels);
}

export interface DocumentSection {
  title: string;
  html: string;
}

const isEmptyParagraph = (node: PMNode) =>
  node.type.name === "paragraph" && node.content.size === 0;

function getDocumentSections(doc: PMNode) {
  const levels: number[] = [];
  doc.forEach((node) => {
    if (node.type.name === "heading") {
      levels.push(Number(node.attrs.level) || 1);
    }
  });
  const splitLevel = splitLevelFor(levels);
  if (splitLevel === null) return [];

  const sections: { title: string; nodes: PMNode[] }[] = [];
  doc.forEach((node) => {
    const isBoundary =
      node.type.name === "heading" &&
      (Number(node.attrs.level) || 1) === splitLevel;

    if (isBoundary) {
      sections.push({ title: node.textContent.trim(), nodes: [] });
      return;
    }
    if (sections.length === 0) {
      if (isEmptyParagraph(node)) return;
      sections.push({ title: "", nodes: [] });
    }
    sections[sections.length - 1].nodes.push(node);
  });
  return sections;
}

export function canSplitDocument(editor: Editor | null): boolean {
  return !!editor && getDocumentSections(editor.state.doc).length >= 2;
}

export function splitDocumentAtHeadings(
  editor: Editor | null,
): DocumentSection[] {
  if (!editor) return [];
  const { doc, schema } = editor.state;
  return getDocumentSections(doc).map((section) => ({
    title: section.title,
    html: getHTMLFromFragment(Fragment.fromArray(section.nodes), schema),
  }));
}
