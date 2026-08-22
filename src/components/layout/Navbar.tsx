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
      <nav className="w-full sticky top-0 z-50 ns-glass border-b border-ns-border transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-between items-center h-16">
            {/* Left Section - Logo */}
            <div className="flex items-center flex-shrink-0 z-10">
              <Link
                to={user ? "/stories" : "/"}
                className="text-2xl sm:text-3xl md:text-4xl font-heading font-semibold text-ns-ink transition-all duration-300 hover:text-ns-accent hover:drop-shadow-lg tracking-tight"
                aria-label={user ? `${APP_NAME} Stories` : `${APP_NAME} Home`}
              >
                {APP_NAME}
              </Link>
            </div>

            {/* Center Section - Section navigation */}
            <nav
              aria-label="Sections"
              className="hidden lg:flex items-center gap-6 xl:gap-8 z-10"
            >
              <NavLinks />
            </nav>

            {/* Right Section - Desktop */}
            <div className="hidden lg:flex items-center gap-4 xl:gap-6 z-10">
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
                    className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full border border-ns-border hover:border-ns-accent/40 hover:bg-ns-surface focus:outline-none focus:ring-2 focus:ring-[var(--ns-ring)] focus:ring-offset-2 focus:ring-offset-[var(--ns-ring-offset)] transition-all"
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
                    to="/try"
                    className="px-4 py-2 border border-ns-border hover:border-ns-border-strong text-ns-ink-secondary hover:text-ns-ink font-ui text-sm rounded-full transition-all duration-200"
                  >
                    Try Editor
                  </Link>
                  <Link
                    to="/sign-in"
                    className="px-5 py-2 bg-ns-accent hover:bg-ns-accent-hover text-white font-ui font-semibold rounded-full transition-all duration-300 hover:scale-105 shadow-ns-sm hover:shadow-ns text-sm"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-3">
              <button
                onClick={toggleMobileMenu}
                className="p-2 text-ns-ink-secondary hover:text-ns-ink hover:bg-ns-surface rounded-ns transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ns-ring)] active:scale-95"
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </>
  );
};

export default Navbar;
