import { Outlet, useLocation, Link } from "react-router-dom";
import { Trophy, BookOpen, Megaphone, Users, Book } from "lucide-react";

interface Tab {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    id: "stories",
    label: "Stories",
    icon: <BookOpen className="w-4 h-4" />,
    path: "/explore/stories",
  },
  {
    id: "community",
    label: "Community",
    icon: <Users className="w-4 h-4" />,
    path: "/explore/community",
  },
  {
    id: "competitions",
    label: "Competitions",
    icon: <Trophy className="w-4 h-4" />,
    path: "/explore/competitions",
  },
  {
    id: "book-clubs",
    label: "Book Clubs",
    icon: <Book className="w-4 h-4" />,
    path: "/explore/book-clubs",
  },
  {
    id: "announcements",
    label: "Announcements",
    icon: <Megaphone className="w-4 h-4" />,
    path: "/explore/announcements",
  },
];

const StoriesLayout = () => {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path ||
    (location.pathname === "/explore" && path === "/explore/stories");

  return (
    <div className="min-h-full bg-ns-bg">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-4">
        <div className="flex gap-8 pt-6 pb-10">
          {/* Desktop left sidebar nav */}
          <aside className="hidden lg:flex w-[236px] shrink-0">
            <div className="sticky top-20 flex h-[calc(100vh-6rem)] flex-col">
              <div className="flex items-center h-9 mb-3 px-3 border-b border-ns-border">
                <span className="font-ui text-[11px] tracking-[1.5px] uppercase text-ns-ink-muted">
                  Explore
                </span>
              </div>
              <nav className="flex flex-col gap-0.5">
                {tabs.map((tab) => {
                  const active = isActive(tab.path);
                  return (
                    <Link
                      key={tab.id}
                      to={tab.path}
                      className={`
                        group flex items-center gap-2.5 px-3 py-2 rounded-ns text-sm font-ui font-medium
                        transition-all duration-150
                        ${
                          active
                            ? "bg-ns-accent text-white hover:text-white shadow-ns-sm"
                            : "text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink"
                        }
                      `}
                    >
                      <span
                        className={`shrink-0 transition-opacity ${active ? "opacity-100" : "opacity-50 group-hover:opacity-80"}`}
                      >
                        {tab.icon}
                      </span>
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile / tablet segmented tab bar */}
            <div className="lg:hidden mb-4 -mx-2 sm:-mx-4">
              <nav className="flex items-stretch border-b border-ns-border">
                {tabs.map((tab) => {
                  const active = isActive(tab.path);
                  return (
                    <Link
                      key={tab.id}
                      to={tab.path}
                      className={`
                        relative flex-1 min-w-0 flex flex-col items-center justify-end gap-1 px-1 pt-2 pb-2.5
                        text-[10px] font-ui font-medium text-center leading-tight
                        transition-colors duration-150 touch-manipulation
                        ${
                          active
                            ? "text-ns-accent hover:text-ns-accent"
                            : "text-ns-ink-muted hover:text-ns-ink"
                        }
                      `}
                    >
                      <span
                        className={`shrink-0 transition-opacity ${active ? "opacity-100" : "opacity-60"}`}
                      >
                        {tab.icon}
                      </span>
                      <span className="w-full truncate">{tab.label}</span>
                      {active && (
                        <span className="absolute -bottom-px inset-x-2 h-0.5 rounded-full bg-ns-accent" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoriesLayout;
