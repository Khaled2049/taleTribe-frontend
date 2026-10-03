import { Link } from "react-router-dom";
import { useRef, useEffect, RefObject, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@novelsync/platform-auth";
import { useNavigate } from "react-router-dom";
import { disconnectWalletIfConnected } from "@/blockchain/disconnectWallet";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { prefetchUserStories } from "@/routes/Story/prefetchUserStories";

import {
  User,
  Shield,
  HelpCircle,
  BookOpen,
  LogOut,
  Loader2,
  ArrowRight,
  Moon,
  Sun,
} from "lucide-react";
import { IUser } from "../../../types/IUser";

interface UserDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  user: IUser | null;
  containerRef?: RefObject<HTMLDivElement | null>;
}

const UserDropdown = ({
  isOpen,
  onClose,
  user,
  containerRef,
}: UserDropdownProps) => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      // Best effort: disconnect wallet before Firebase sign-out.
      try {
        await disconnectWalletIfConnected();
      } catch (disconnectError) {
        console.warn(
          "Wallet disconnect failed during sign-out:",
          disconnectError,
        );
      }

      await signOut(auth);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        containerRef?.current &&
        !containerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("click", handleClickOutside);
      };
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, onClose, containerRef]);

  if (!isOpen || !user) return null;

  const menuItems = [
    {
      icon: BookOpen,
      label: "My Shelf",
      to: "/user-stories",
      onClick: onClose,
      prefetch: () => prefetchUserStories(user.uid),
    },
    {
      icon: Shield,
      label: "Privacy Policy",
      to: "/privacy-policy",
      onClick: onClose,
      prefetch: undefined,
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      to: "/help",
      onClick: onClose,
      prefetch: undefined,
    },
  ];

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-64 bg-ns-elevated text-ns-ink rounded-ns-xl shadow-ns-lg z-50 overflow-hidden border border-ns-border animate-ns-slide-down"
    >
      {/* User Info — editorial header with accent-tinted band */}
      <Link
        to={`/profile/${user.uid}`}
        onClick={onClose}
        className="group/header relative block border-b border-ns-border bg-gradient-to-br from-ns-accent-subtle to-ns-surface px-4 pt-5 pb-4 transition-colors"
      >
        <div className="flex items-center gap-3">
          {user.photoURL && user.photoURL.trim() !== "" ? (
            <img
              src={user.photoURL}
              alt="User Avatar"
              className="w-12 h-12 rounded-full border-2 border-ns-elevated shadow-ns-sm object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ns-accent border-2 border-ns-elevated shadow-ns-sm flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-ui text-sm font-semibold truncate text-ns-ink">
              @{user.username || "user"}
            </p>
            <p className="font-ui text-xs text-ns-ink-muted truncate">
              {user.email}
            </p>
          </div>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 font-ui text-[11px] font-semibold uppercase tracking-wide text-ns-accent">
          View profile
          <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover/header:translate-x-0.5" />
        </span>
      </Link>

      {/* Menu Items */}
      <div className="py-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={item.onClick}
              onMouseEnter={item.prefetch}
              onFocus={item.prefetch}
              onTouchStart={item.prefetch}
              className="group relative flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ns-surface transition-colors"
            >
              {/* accent bar slides in on hover */}
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-ns-accent scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200" />
              <Icon className="w-4 h-4 text-ns-ink-muted group-hover:text-ns-accent transition-colors" />
              <span className="font-ui text-ns-ink-secondary group-hover:text-ns-ink transition-colors">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Theme toggle */}
      <div className="border-t border-ns-border py-1.5">
        <button
          type="button"
          onClick={toggleTheme}
          className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-ns-surface transition-colors"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {/* accent bar slides in on hover */}
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-ns-accent scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200" />
          {theme === "light" ? (
            <Moon className="w-4 h-4 text-ns-ink-muted group-hover:text-ns-accent transition-colors" />
          ) : (
            <Sun className="w-4 h-4 text-ns-ink-muted group-hover:text-ns-gold transition-colors" />
          )}
          <span className="font-ui text-ns-ink-secondary group-hover:text-ns-ink transition-colors">
            {theme === "light" ? "Dark mode" : "Light mode"}
          </span>
        </button>
      </div>

      {/* Sign Out */}
      <div className="border-t border-ns-border">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-ns-destructive hover:bg-ns-destructive/5 transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSigningOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-ui">Signing out...</span>
            </>
          ) : (
            <>
              <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-ui">Sign Out</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UserDropdown;
