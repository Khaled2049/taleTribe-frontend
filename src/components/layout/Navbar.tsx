import { Link } from "react-router-dom";
import { useAuthContext } from "../../contexts/AuthContext";
import { useState, useRef } from "react";
import { Loader, Menu, User } from "lucide-react";
import { WalletConnectButton } from "../web3/WalletConnectButton";
import UserDropdown from "./navbar/UserDropdown";
import MobileMenu from "./navbar/MobileMenu";
import NavLinks from "./navbar/NavLinks";
import { APP_NAME } from "../../config/seo";
import { WEB3_ENABLED } from "../../config/featureFlags";

const Navbar = () => {
  const { user, loading } = useAuthContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="relative z-50 w-full shrink-0 border-b border-ns-border bg-ns-bg/95 backdrop-blur-md transition-colors duration-300">
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, var(--ns-accent), var(--ns-gold-bright), var(--ns-teal))",
          }}
          aria-hidden="true"
        />
        <nav
          className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8 lg:px-10"
          aria-label="Primary navigation"
        >
          <Link
            to="/"
            className="group inline-flex shrink-0 items-center gap-3 text-ns-ink no-underline"
            aria-label={`${APP_NAME} home`}
          >
            <span
              className="relative flex h-7 w-7 items-center justify-center rounded-full border border-ns-border-strong bg-ns-accent-subtle transition-colors duration-300 group-hover:border-ns-accent"
              aria-hidden="true"
            >
              <span className="h-3.5 w-px -rotate-[28deg] bg-ns-accent" />
            </span>
            <span className="font-heading text-[1.65rem] font-medium tracking-[-0.02em]">
              {APP_NAME}
            </span>
          </Link>

          <div
            role="group"
            aria-label="Sections"
            className="hidden items-center gap-6 lg:flex xl:gap-8"
          >
            <NavLinks />
          </div>

          <div className="hidden items-center gap-4 lg:flex xl:gap-6">
            {/* Wallet Connect Button */}
            {WEB3_ENABLED && (
              <div className="flex items-center">
                <WalletConnectButton />
              </div>
            )}

            {/* User Dropdown */}
            {loading ? (
              <div className="flex items-center justify-center w-10 h-10">
                <Loader className="w-6 h-6 animate-spin text-ns-accent" />
              </div>
            ) : user ? (
              <div className="relative" ref={dropdownContainerRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown();
                  }}
                  className="flex items-center gap-3 rounded-full border border-ns-border py-1.5 pl-1.5 pr-3 transition-all hover:border-ns-accent/40 hover:bg-ns-surface focus:outline-none focus:ring-2 focus:ring-[var(--ns-ring)] focus:ring-offset-2 focus:ring-offset-[var(--ns-ring-offset)]"
                  aria-label="User menu"
                  aria-expanded={isDropdownOpen}
                >
                  {user.photoURL && user.photoURL.trim() !== "" ? (
                    <img
                      src={user.photoURL}
                      alt="User Avatar"
                      className="w-9 h-9 rounded-full border-2 border-ns-border object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-ns-accent flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <span className="font-ui text-sm font-semibold text-ns-ink truncate max-w-[180px]">
                    @{user.username || "user"}
                  </span>
                </button>
                <UserDropdown
                  isOpen={isDropdownOpen}
                  onClose={closeDropdown}
                  user={user}
                  containerRef={dropdownContainerRef}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/sign-in"
                  className="px-2.5 py-2 font-ui text-sm font-medium text-ns-ink-secondary no-underline transition-colors duration-200 hover:text-ns-ink sm:px-3"
                >
                  Sign in
                </Link>
                <Link
                  to="/sign-up"
                  className="rounded-full bg-ns-ink px-5 py-2.5 font-ui text-sm font-semibold text-ns-bg no-underline transition-all duration-200 hover:-translate-y-0.5 hover:bg-ns-accent hover:text-[var(--ns-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-bg active:translate-y-0"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={toggleMobileMenu}
              className="rounded-full border border-ns-border-strong bg-ns-surface p-2 text-ns-ink-secondary transition-colors hover:border-ns-accent hover:text-ns-accent focus:outline-none focus:ring-2 focus:ring-[var(--ns-ring)] active:scale-95"
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </>
  );
};

export default Navbar;
