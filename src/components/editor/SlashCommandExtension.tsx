import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { PluginKey, type EditorState } from "@tiptap/pm/state";
import {
  type LucideIcon,
  MessageSquare,
  PenLine,
  Image,
  Heading1,
  Heading2,
  List,
  Code,
  ListChecks,
} from "lucide-react";
import SlashCommandMenu from "./SlashCommandMenu";

type CommandContext = { editor: Editor; range: Range };
type MenuHandle = { onKeyDown(props: { event: KeyboardEvent }): boolean };

export interface SlashCommand {
  title: string;
  description: string;
  icon?: LucideIcon;
  command: (props: CommandContext) => void;
}

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: new PluginKey("slashCommand"),
        command: ({
          editor,
          range,
          props,
        }: CommandContext & {
          props: SlashCommand & { item?: SlashCommand };
        }) => {
          props.command({ editor, range });
        },
        allow: ({ state, range }: { state: EditorState; range: Range }) => {
          const $from = state.doc.resolve(range.from);
          const isAtStart =
            $from.parent.textContent.charAt(range.from - $from.start() - 1) ===
            "";
          return (
            isAtStart ||
            $from.parent.textContent.charAt(range.from - $from.start() - 1) ===
              " "
          );
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      // Import Suggestion plugin from @tiptap/suggestion
      // You'll need to install: npm install @tiptap/suggestion
    ];
  },
});

// Suggestion configuration
/**
 * Floats the menu at the suggestion caret. Uses the floating-ui that TipTap's
 * menus already load rather than a second positioning library. Fixed
 * positioning plus autoUpdate keeps it attached while the editor's inner
 * scroll container scrolls.
 */
function createSuggestionPopup(content: HTMLElement, contextElement: Element) {
  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "fixed",
    top: "0",
    left: "0",
    zIndex: "9999",
    visibility: "hidden",
  });
  root.appendChild(content);
  document.body.appendChild(root);

  let getRect: () => DOMRect | null = () => null;
  const reference = {
    getBoundingClientRect: () => getRect() ?? new DOMRect(),
    contextElement,
  };
  const place = () => {
    if (!getRect()) return;
    void computePosition(reference, root, {
      strategy: "fixed",
      placement: "bottom-start",
      middleware: [offset(10), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      root.style.visibility = "visible";
    });
  };
  const stopAutoUpdate = autoUpdate(reference, root, place);

  return {
    setReference(rect: () => DOMRect | null) {
      getRect = rect;
      place();
    },
    hide() {
      root.style.display = "none";
    },
    destroy() {
      stopAutoUpdate();
      root.remove();
    },
  };
}

export const slashCommandSuggestion = (
  onGenerateNextLine: () => Promise<void>,
  onGenerateImage: () => void,
  onCoWrite: () => void,
): Partial<SuggestionOptions> => ({
  char: "/",
  pluginKey: new PluginKey("slashCommand"),

  items: ({ query }: { query: string }): SlashCommand[] => {
    const commands: SlashCommand[] = [
      {
        title: "Co-Write",
        description: "Open interactive storytelling panel",
        icon: MessageSquare,
        command: ({ editor, range }: CommandContext) => {
          editor.chain().focus().deleteRange(range).run();
          onCoWrite();
        },
      },
      {
        title: "Generate Next Line",
        description: "AI generates suggestions for the next line",
        icon: PenLine,
        command: async ({ editor, range }: CommandContext) => {
          editor.chain().focus().deleteRange(range).run();
          await onGenerateNextLine();
        },
      },
      {
        title: "Generate Image",
        description: "AI generates an image from your description",
        icon: Image,
        command: ({ editor, range }: CommandContext) => {
          editor.chain().focus().deleteRange(range).run();
          onGenerateImage();
        },
      },
      {
        title: "Heading 1",
        description: "Large section heading",
        icon: Heading1,
        command: ({ editor, range }: CommandContext) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleHeading({ level: 1 })
            .run();
        },
      },
      {
        title: "Heading 2",
        description: "Medium section heading",
        icon: Heading2,
        command: ({ editor, range }: CommandContext) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .toggleHeading({ level: 2 })
            .run();
        },
      },
      {
        title: "Bullet List",
        description: "Create a bullet list",
        icon: List,
        command: ({ editor, range }: CommandContext) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: "Code Block",
        description: "Insert a code block with syntax highlighting",
        icon: Code,
        command: ({ editor, range }: CommandContext) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: "Task List",
        description: "Create a checklist with checkboxes",
        icon: ListChecks,
        command: ({ editor, range }: CommandContext) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
      },
    ];

    return commands.filter((command) =>
      command.title.toLowerCase().includes(query.toLowerCase()),
    );
  },

  command: ({
    editor,
    range,
    props,
  }: CommandContext & { props: SlashCommand & { item?: SlashCommand } }) => {
    // This is called when Enter is pressed or item is selected
    // props.item is the selected SlashCommand
    if (props.item && props.item.command) {
      props.item.command({ editor, range });
    }
  },

  render: () => {
    let component: ReactRenderer<MenuHandle>;
    let popup: ReturnType<typeof createSuggestionPopup> | null = null;

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(SlashCommandMenu, {
          props: {
            items: props.items,
            command: (item: SlashCommand) => {
              // Execute the command with editor and range
              item.command({
                editor: props.editor,
                range: props.range,
              });
              // Close the suggestion menu
              popup?.hide();
            },
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = createSuggestionPopup(component.element, props.editor.view.dom);
        popup.setReference(props.clientRect);
      },

      onUpdate(props: SuggestionProps) {
        component.updateProps({
          items: props.items,
          command: (item: SlashCommand) => {
            // Execute the command with editor and range
            item.command({
              editor: props.editor,
              range: props.range,
            });
            // Close the suggestion menu
            popup?.hide();
          },
        });

        if (!props.clientRect) {
          return;
        }

        popup?.setReference(props.clientRect);
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }

        // Handle Enter key - execute the selected command
        if (props.event.key === "Enter") {
          const handled = component.ref?.onKeyDown(props);
          if (handled) {
            props.event.preventDefault();
            props.event.stopPropagation();
            return true;
          }
        }

        // For arrow keys, let the menu handle them
        const handled = component.ref?.onKeyDown(props);
        if (handled) {
          props.event.preventDefault();
          props.event.stopPropagation();
          return true;
        }
        return false;
      },

      onExit() {
        popup?.destroy();
        popup = null;
        if (component) {
          component.destroy();
        }
      },
    };
  },
});
