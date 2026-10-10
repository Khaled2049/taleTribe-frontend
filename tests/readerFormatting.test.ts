import { describe, expect, it } from "vitest";
import {
  buildSegments,
  extractFormattedText,
  formatClassName,
  paragraphClassName,
  type FormatNode,
} from "@/lib/readerFormatting";

const text = (value: string): FormatNode => ({
  nodeType: 3,
  nodeName: "#text",
  nodeValue: value,
  childNodes: [],
});
const el = (name: string, ...children: FormatNode[]): FormatNode => ({
  nodeType: 1,
  nodeName: name,
  nodeValue: null,
  childNodes: children,
});
const textContent = (node: FormatNode): string =>
  node.nodeType === 3
    ? (node.nodeValue ?? "")
    : Array.from(node.childNodes).map(textContent).join("");
const legacyText = (node: FormatNode) =>
  textContent(node).replace(/\s+/g, " ").trim();

describe("extractFormattedText", () => {
  it("returns the same text the reader has always indexed", () => {
    const samples = [
      el(
        "P",
        text("  She  paused.\n\t"),
        el("EM", text(" Not  now. ")),
        text(" "),
      ),
      el("P", el("STRONG", text("Bold")), text(" "), el("U", text("under"))),
      el("LI", el("P", text("one ")), el("P", text(" two"))),
      el("P", text("   ")),
      el("P"),
    ];
    for (const sample of samples) {
      expect(extractFormattedText(sample).text).toBe(legacyText(sample));
    }
  });

  it("locates bold and italic runs in the normalized text", () => {
    const { text: out, spans } = extractFormattedText(
      el(
        "P",
        text("  She "),
        el("EM", text("knew")),
        text(" it "),
        el("STRONG", text("all")),
        text("."),
      ),
    );
    expect(out).toBe("She knew it all.");
    expect(spans).toEqual([
      { start: 4, end: 8, italic: true },
      { start: 12, end: 15, bold: true },
    ]);
  });

  it("combines nested marks and keeps a gap inside one run formatted", () => {
    const { text: out, spans } = extractFormattedText(
      el("P", el("STRONG", text("a  "), el("EM", text("b")), text(" c"))),
    );
    expect(out).toBe("a b c");
    expect(spans).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 2, end: 3, bold: true, italic: true },
      { start: 3, end: 5, bold: true },
    ]);
  });

  it("leaves the space between a formatted and a plain word plain", () => {
    const { spans } = extractFormattedText(
      el("P", el("U", text("one ")), text("two")),
    );
    expect(spans).toEqual([{ start: 0, end: 3, underline: true }]);
  });

  it("ignores spans, links and other tags it does not carry", () => {
    const { text: out, spans } = extractFormattedText(
      el("P", el("SPAN", text("red ")), el("A", text("link"))),
    );
    expect(out).toBe("red link");
    expect(spans).toEqual([]);
  });
});

describe("buildSegments", () => {
  it("splits on formatting and keeps the text intact", () => {
    const segments = buildSegments("She knew it.", 100, [], "b", [
      { start: 4, end: 8, italic: true },
    ]);
    expect(segments.map((s) => s.text)).toEqual(["She ", "knew", " it."]);
    expect(segments.map((s) => Boolean(s.format))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("keeps formatting on the part of a run a highlight covers", () => {
    const segments = buildSegments(
      "She knew it.",
      100,
      [{ start: 106, end: 111, kind: "highlight", color: "yellow", id: "h" }],
      "b",
      [{ start: 4, end: 8, italic: true }],
    );
    expect(segments.map((s) => [s.text, s.kind, Boolean(s.format)])).toEqual([
      ["She ", "text", false],
      ["kn", "text", true],
      ["ew", "highlight", true],
      [" it", "highlight", false],
      [".", "text", false],
    ]);
    expect(segments.map((s) => s.text).join("")).toBe("She knew it.");
  });
});

describe("formatClassName", () => {
  it("combines underline and strikethrough rather than letting one win", () => {
    expect(
      formatClassName({ start: 0, end: 1, underline: true, strike: true }),
    ).toBe("[text-decoration-line:underline_line-through]");
    expect(
      formatClassName({ start: 0, end: 1, bold: true, italic: true }),
    ).toBe("font-bold italic");
  });
});

describe("paragraphClassName", () => {
  const block = (kind: "p" | "h2" | "hr", align?: "center") => ({
    key: kind,
    kind,
    start: 0,
    end: 0,
    ...(align ? { align } : {}),
  });
  const blocks = [
    block("h2"),
    block("p"),
    block("p"),
    block("hr"),
    block("p"),
    block("p", "center"),
  ];

  it("keeps a gap after every paragraph when spaced", () => {
    expect(paragraphClassName(blocks, 1, "spaced")).toBe("mb-6");
  });

  it("indents only a paragraph that follows another", () => {
    expect(paragraphClassName(blocks, 1, "indented")).toBe("mb-0");
    expect(paragraphClassName(blocks, 2, "indented")).toBe(
      "mb-6 indent-[1.5em]",
    );
    expect(paragraphClassName(blocks, 4, "indented")).toBe("mb-0");
  });

  it("leaves a centred paragraph flush", () => {
    expect(paragraphClassName(blocks, 5, "indented")).toBe("mb-6");
  });
});
