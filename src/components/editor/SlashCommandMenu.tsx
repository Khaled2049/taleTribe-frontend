import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { SlashCommand } from "./SlashCommandExtension";

interface SlashCommandMenuProps {
  items: SlashCommand[];
  command: (command: SlashCommand) => void;
}

const SlashCommandMenu = forwardRef<
  { onKeyDown(props: { event: KeyboardEvent }): boolean },
  SlashCommandMenuProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length,
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 px-1 max-h-80 overflow-y-auto">
      {props.items.length > 0 ? (
        props.items.map((item, index) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            data-cy={`slash-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
            className={`w-full text-left px-3 py-2 rounded-md flex items-start gap-3 transition-colors ${
              index === selectedIndex
                ? "bg-dark-green text-white"
                : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {item.icon ? (
                <item.icon className="w-5 h-5" />
              ) : (
                <span className="text-lg leading-none">•</span>
              )}
            </span>
            <div className="flex flex-col">
              <span className="font-medium">{item.title}</span>
              <span
                className={`text-sm ${
                  index === selectedIndex
                    ? "text-white/80"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {item.description}
              </span>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
          No results
        </div>
      )}
    </div>
  );
});

SlashCommandMenu.displayName = "SlashCommandMenu";

export default SlashCommandMenu;
