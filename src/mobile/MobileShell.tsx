import { ChevronLeft, Compass, Library, User } from "lucide-react";
import {
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { APP_NAME } from "@/config/seo";

const TABS = [
  { to: "/stories", label: "Discover", icon: Compass },
  { to: "/shelf", label: "Shelf", icon: Library },
  { to: "/account", label: "Account", icon: User },
] as const;

const TAB_ROOTS = new Set<string>(TABS.map((tab) => tab.to));

export const MobileShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // The reader draws its own fixed bars and pads itself for the safe areas.
  const inReader = !!useMatch("/story/:id/read/:chapterId?");
  const onSignIn = location.pathname === "/sign-in";
  const showBack = !TAB_ROOTS.has(location.pathname);

  const goBack = () => {
    // idx is React Router's position in this session's history stack.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/stories", { replace: true });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ns-bg text-ns-ink">
      {!inReader && (
        <header className="shrink-0 border-b border-ns-border bg-ns-bg pt-[env(safe-area-inset-top)]">
          <div className="relative flex h-11 items-center justify-center px-2">
            {showBack && (
              <button
                onClick={goBack}
                aria-label="Back"
                className="absolute left-1 flex h-11 w-11 items-center justify-center text-ns-ink-secondary active:text-ns-ink"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <span className="font-heading text-xl italic text-ns-ink">
              {APP_NAME}
            </span>
          </div>
        </header>
      )}

      {/* Same contract as the web NavbarWrapper: the page scrolls here, not on
          window, and shared code finds it through data-app-scroll. */}
      <main data-app-scroll className="min-h-0 w-full flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {!inReader && !onSignIn && (
        <nav
          aria-label="Primary"
          className="shrink-0 border-t border-ns-border bg-ns-bg pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2 font-ui text-[11px] no-underline transition-colors ${
                    isActive ||
                    (to === "/stories" && location.pathname.startsWith("/stor"))
                      ? "text-ns-accent"
                      : "text-ns-ink-muted"
                  }`
                }
              >
                <Icon className="h-6 w-6" strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};
