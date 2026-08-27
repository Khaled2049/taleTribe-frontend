import React from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

type GuestbookTab = "wall" | "people" | "settings";

interface GuestbookTabsProps {
  active: GuestbookTab;
  /** "{n} entries", shown right-aligned. */
  trailingCount?: number;
}

const tabClass = (isActive: boolean) => `
  relative px-1 pb-2 font-ui text-sm font-medium no-underline
  transition-colors duration-150
  ${isActive ? "text-ns-ink" : "text-ns-ink-secondary hover:text-ns-ink"}
`;

const Underline = () => (
  <span className="absolute -bottom-px inset-x-0 h-0.5 rounded-full bg-ns-accent" />
);

const GuestbookTabs: React.FC<GuestbookTabsProps> = ({
  active,
  trailingCount,
}) => {
  const { user } = useAuthContext();

  return (
    <nav
      aria-label="Guestbook"
      className="flex items-center gap-6 border-b border-ns-border mb-8"
    >
      {user && (
        <Link
          to="/guestbook"
          aria-current={active === "wall" ? "page" : undefined}
          className={tabClass(active === "wall")}
        >
          Wall
          {active === "wall" && <Underline />}
        </Link>
      )}

      <Link
        to="/guestbook/people"
        aria-current={active === "people" ? "page" : undefined}
        className={tabClass(active === "people")}
      >
        People
        {active === "people" && <Underline />}
      </Link>

      {trailingCount !== undefined && (
        <span className="ml-auto font-ui text-[13px] text-ns-ink-muted pb-2">
          {trailingCount} {trailingCount === 1 ? "entry" : "entries"}
        </span>
      )}
    </nav>
  );
};

export default GuestbookTabs;
