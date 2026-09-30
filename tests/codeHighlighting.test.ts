import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import {
  codeGrammarsLoaded,
  containsNodeType,
  loadCodeGrammars,
  lowlight,
} from "@/components/editor/codeHighlighting";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    blockquote: { group: "block", content: "block+" },
    codeBlock: { group: "block", content: "text*", code: true },
    text: {},
  },
});

const p = (text: string) =>
  schema.nodes.paragraph.create(null, schema.text(text));
const code = (text: string) =>
  schema.nodes.codeBlock.create(null, schema.text(text));

describe("containsNodeType", () => {
  it("finds a top-level code block", () => {
    const doc = schema.nodes.doc.create(null, [p("a"), code("x = 1")]);
    expect(containsNodeType(doc, "codeBlock")).toBe(true);
  });

  it("finds a nested code block", () => {
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.blockquote.create(null, [code("x")]),
    ]);
    expect(containsNodeType(doc, "codeBlock")).toBe(true);
  });

  it("reports prose without code blocks", () => {
    const doc = schema.nodes.doc.create(null, [p("a"), p("b")]);
    expect(containsNodeType(doc, "codeBlock")).toBe(false);
  });
});

// Module state is shared, so these run in order: empty first, then loaded.
describe("loadCodeGrammars", () => {
  it("starts with no grammars registered", () => {
    expect(codeGrammarsLoaded()).toBe(false);
    expect(lowlight.listLanguages()).toEqual([]);
  });

  it("registers every language and alias once loaded", async () => {
    await loadCodeGrammars();
    expect(codeGrammarsLoaded()).toBe(true);
    for (const language of [
      "javascript",
      "js",
      "typescript",
      "ts",
      "python",
      "py",
      "css",
      "html",
      "xml",
      "bash",
      "sh",
      "json",
      "rust",
      "go",
    ]) {
      expect(lowlight.registered(language)).toBe(true);
    }
  });

  it("reuses the same load", () => {
    expect(loadCodeGrammars()).toBe(loadCodeGrammars());
  });
});
