import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { TextSelection } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Unlink,
} from "lucide-react";
import { useFormatState } from "./useLiveEditorState";

export function SelectionToolbar({
  editor,
  onLink,
}: {
  editor: Editor;
  onLink: () => void;
}) {
  const format = useFormatState(editor);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const actions = [
    {
      label: "Bold",
      icon: Bold,
      active: format.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: format.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: Underline,
      active: format.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: format.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: format.link ? "Edit link" : "Add link",
      icon: Link2,
      active: format.link,
      run: onLink,
    },
    ...(format.link
      ? [
          {
            label: "Remove link",
            icon: Unlink,
            active: false,
            run: () => editor.chain().focus().unsetLink().run(),
          },
        ]
      : []),
  ];

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state, from, to }) =>
        editor.isEditable &&
        (editor.isFocused ||
          !!toolbarRef.current?.contains(document.activeElement)) &&
        state.selection instanceof TextSelection &&
        from !== to &&
        !!state.doc.textBetween(from, to).trim()
      }
      className="rounded-ns border border-ns-border-strong bg-ns-surface p-1 shadow-ns-lg"
    >
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Selected text formatting"
        className="flex items-center gap-0.5"
      >
        {actions.map(({ label, icon: Icon, active, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-ns transition-colors hover:bg-ns-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)] ${
              active
                ? "bg-ns-accent-subtle text-ns-accent"
                : "text-ns-ink-secondary hover:text-ns-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </BubbleMenu>
  );
}
