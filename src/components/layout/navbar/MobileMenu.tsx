import { Link, useLocation, useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "../../../hooks/useFirebaseAuth";
import { useAuthContext } from "../../../contexts/AuthContext";
import { useState } from "react";
import {
  Shield,
  HelpCircle,
  BookMarked,
  BookOpen,
  LogOut,
  X,
  Loader2,
  Compass,
  Trophy,
  Users,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import { useWalletState } from "@/hooks/useWalletState";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mirrors NavLinks.tsx — this is the mobile half of that nav. The guestbook
 * link needs a uid and so only exists for a signed-in viewer, exactly as on
 * desktop; this menu also renders for signed-out visitors.
 */
const buildDiscoverItems = (uid?: string) => [
  { to: "/stories", label: "Stories", icon: Compass },
  { to: "/competitions", label: "Competitions", icon: Trophy },
  { to: "/book-clubs", label: "Book Clubs", icon: Users },
  ...(uid
    ? [{ to: `/guestbook/${uid}`, label: "Guestbook", icon: BookMarked }]
    : []),
];

const accountItems = [
  { icon: Shield, label: "Privacy Policy", to: "/privacy-policy" },
  { icon: HelpCircle, label: "Help & Support", to: "/help" },
  { icon: BookOpen, label: "My Shelf", to: "/user-stories" },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-4 pt-2 pb-1 text-xs font-ui font-medium uppercase tracking-wider text-ns-ink-muted">
      {children}
    </p>
  );
}

function navLinkClass(isActive: boolean) {
  return [
    "flex items-center gap-3 px-4 py-3 rounded-ns font-ui transition-colors",
    isActive
      ? "bg-ns-accent-subtle text-ns-accent"
      : "text-ns-ink hover:bg-ns-surface",
  ].join(" ");
}

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const { signout } = useFirebaseAuth();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { address, disconnectWallet } = useWalletState();
  const { theme, toggleTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      if (address) {
        try {
          await disconnectWallet();
        } catch (disconnectError) {
          console.warn(
            "Wallet disconnect failed during sign-out:",
            disconnectError,
          );
        }
      }

      await signout();
      onClose();
      navigate("/sign-in");
      toast.success("Signed out successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sign out";
      toast.error(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignIn = () => {
    navigate("/sign-in");
    onClose();
  };

  return (
    <div
      className={`lg:hidden fixed inset-0 z-50 bg-ns-bg transition-transform duration-300 ease-ns-spring ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-ns-border shrink-0">
          <h2 className="text-xl font-heading font-semibold text-ns-accent">
            Menu
          </h2>
          <div className="flex items-center gap-2">
            {/* <ThemeToggle /> */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-ns-ink-secondary hover:text-ns-ink hover:bg-ns-surface rounded-ns transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {user ? (
              <>
                <Link
                  to={`/profile/${user.uid}`}
                  onClick={onClose}
                  className="flex items-center gap-3 p-4 mb-2 rounded-ns-lg bg-ns-surface border border-ns-border hover:border-ns-border-strong hover:bg-ns-surface-hover transition-colors group"
                >
                  {user.photoURL && user.photoURL.trim() !== "" ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-12 h-12 rounded-full border-2 border-ns-border object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-ns-accent flex items-center justify-center shrink-0">
                      <span className="text-white text-lg font-semibold font-ui">
                        {user.username?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold font-ui truncate text-ns-ink">
                      @{user.username || "user"}
                    </p>
                    <p className="text-sm text-ns-ink-muted truncate">
                      {user.email}
                    </p>
                    <p className="text-xs text-ns-accent mt-0.5 font-ui group-hover:underline">
                      View profile
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ns-ink-muted shrink-0" />
                </Link>

                <nav aria-label="Discover" className="mb-4">
                  <SectionLabel>Discover</SectionLabel>
                  <div className="space-y-0.5">
                    {buildDiscoverItems(user.uid).map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={onClose}
                          className={navLinkClass(isActive)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Icon
                            className={`w-5 h-5 shrink-0 ${isActive ? "text-ns-accent" : "text-ns-ink-muted"}`}
                          />
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                <nav aria-label="Account" className="mb-2">
                  <SectionLabel>Account</SectionLabel>
                  <div className="space-y-0.5">
                    {accountItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={onClose}
                          className={navLinkClass(isActive)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Icon
                            className={`w-5 h-5 shrink-0 ${isActive ? "text-ns-accent" : "text-ns-ink-muted"}`}
                          />
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </nav>
              </>
            ) : (
              <>
                <div className="space-y-2 mb-6">
                  <Link
                    to="/try"
                    onClick={onClose}
                    className="block w-full px-4 py-3 border border-ns-border hover:border-ns-border-strong text-ns-ink text-center font-ui rounded-ns transition-colors"
                  >
                    Try Editor
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="w-full px-4 py-3 bg-ns-accent hover:bg-ns-accent-hover text-white font-semibold font-ui rounded-ns transition-colors"
                  >
                    Sign In
                  </button>
                </div>

                <nav aria-label="Discover">
                  <SectionLabel>Discover</SectionLabel>
                  <div className="space-y-0.5">
                    {buildDiscoverItems().map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={onClose}
                          className={navLinkClass(isActive)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Icon
                            className={`w-5 h-5 shrink-0 ${isActive ? "text-ns-accent" : "text-ns-ink-muted"}`}
                          />
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </nav>
              </>
            )}

            <nav aria-label="Appearance" className="mt-4">
              <SectionLabel>Appearance</SectionLabel>
              <button
                type="button"
                onClick={toggleTheme}
                className={`${navLinkClass(false)} w-full text-left`}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? (
                  <Moon className="w-5 h-5 shrink-0 text-ns-ink-muted" />
                ) : (
                  <Sun className="w-5 h-5 shrink-0 text-ns-ink-muted" />
                )}
                <span className="flex-1">
                  {theme === "light" ? "Dark mode" : "Light mode"}
                </span>
              </button>
            </nav>
          </div>

          {user && (
            <div className="shrink-0 p-4 pt-0 border-t border-ns-border bg-ns-bg">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 text-ns-destructive hover:bg-ns-destructive/5 rounded-ns transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-ui"
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
