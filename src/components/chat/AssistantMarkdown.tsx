import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ns-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-ns-ink-muted line-through">{children}</del>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 font-heading text-lg font-semibold text-ns-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 font-heading text-base font-semibold text-ns-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3.5 font-ui text-[11px] font-bold uppercase tracking-[0.13em] text-ns-accent first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-3 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-ns-ink-secondary first:mt-0">
      {children}
    </h4>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-1 list-outside list-disc space-y-1 pl-4 marker:text-ns-ink-muted last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-1 list-outside list-decimal space-y-1 pl-4 marker:text-ns-ink-muted last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-ns-accent/40 bg-ns-surface py-1.5 pl-3 pr-2 font-body text-ns-ink-secondary last:mb-0 [&>*:last-child]:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) =>
    className?.includes("language-") ? (
      <code className="block font-mono text-[13px] leading-6">{children}</code>
    ) : (
      <code className="rounded border border-ns-border bg-ns-surface px-1 py-0.5 font-mono text-[0.85em] text-ns-ink">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-ns border border-ns-border bg-ns-surface p-3 last:mb-0">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-ns-accent underline decoration-ns-accent/40 underline-offset-2 hover:decoration-ns-accent"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-ns-border" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-ns-border bg-ns-surface px-2 py-1 text-left font-ui text-xs font-semibold text-ns-ink-secondary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-ns-border px-2 py-1 align-top">{children}</td>
  ),
};

export const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="text-[15px] leading-7 text-ns-ink">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  );
});
