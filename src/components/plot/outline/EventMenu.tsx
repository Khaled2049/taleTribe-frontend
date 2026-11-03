import React from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface CardMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a separator above this item. */
  separated?: boolean;
}

interface EventMenuProps {
  eventId: string;
  eventName: string;
  items: CardMenuItem[];
  className?: string;
}

/** An event's actions menu on an outline card. */
export const EventMenu: React.FC<EventMenuProps> = ({
  eventId,
  eventName,
  items,
  className = "",
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      id={`plot-event-${eventId}-menu`}
      aria-label={`Actions for ${eventName}`}
      className={`flex-shrink-0 p-1.5 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover ${className}`}
    >
      <MoreHorizontal className="w-4 h-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="border border-ns-border bg-ns-elevated shadow-ns-lg rounded-ns-lg p-1 min-w-[200px]"
    >
      {items.map((item) => (
        <React.Fragment key={item.label}>
          {item.separated && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={item.onSelect}
            disabled={item.disabled}
            className={`px-3 py-2 rounded-ns cursor-pointer font-ui text-sm data-[disabled]:opacity-40 data-[disabled]:cursor-default ${
              item.destructive ? "text-ns-destructive" : "text-ns-ink"
            }`}
          >
            {item.label}
          </DropdownMenuItem>
        </React.Fragment>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
