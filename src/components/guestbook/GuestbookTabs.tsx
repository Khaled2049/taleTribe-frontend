import React from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

type GuestbookTab = "wall" | "people" | "settings";

interface GuestbookTabsProps {
  active: GuestbookTab;
  /**
   * Whose wall the Wall tab points at — the viewed user on a guestbook page, or
   * your own when the directory or settings are open. Omitted for a signed-out
   * viewer, who has no wall of their own to return to.
   */
  wallUserId?: string;
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
  wallUserId,
}) => {
  const { user } = useAuthContext();

  // Settings are always your own, never the viewed user's — so the tab is
  // hidden while reading someone else's wall, where it would read as theirs.
  const showSettings =
    !!user && (active !== "wall" || user.uid === wallUserId);

  return (
    <nav
      aria-label="Guestbook"
      className="flex items-center gap-6 border-b border-ns-border mb-8"
    >
      {wallUserId && (
        <Link
          to={`/guestbook/${wallUserId}`}
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

      {showSettings && (
        <Link
          to="/guestbook/settings"
          aria-current={active === "settings" ? "page" : undefined}
          // Icon-only, so the label lives in aria-label and title rather than
          // on screen.
          aria-label="Guestbook settings"
          title="Guestbook settings"
          className={`ml-auto inline-flex items-center ${tabClass(active === "settings")}`}
        >
          <Settings className="w-4 h-4" />
          {active === "settings" && <Underline />}
        </Link>
      )}
    </nav>
  );
};

export default GuestbookTabs;
