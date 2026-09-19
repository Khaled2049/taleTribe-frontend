import { Link, useLocation } from "react-router-dom";

interface NavLinksProps {
  className?: string;
  onLinkClick?: () => void;
}

/**
 * Primary section navigation. Each section is its own top-level route — the
 * /explore shell that used to nest them is gone, and only redirects remain.
 */
const SECTIONS = [
  { to: "/stories", label: "Stories" },
  { to: "/competitions", label: "Competitions" },
  { to: "/book-clubs", label: "Book Clubs" },
] as const;

const NavLinks = ({ className = "", onLinkClick }: NavLinksProps) => {
  const location = useLocation();

  const isActive = (to: string) =>
    location.pathname === to ||
    // A competition detail page is still the competitions section.
    location.pathname.startsWith(`${to}/`);

  return (
    <>
      {SECTIONS.map((link) => {
        const active = isActive(link.to);
        return (
          <Link
            key={link.to}
            to={link.to}
            onClick={onLinkClick}
            aria-current={active ? "page" : undefined}
            className={`
              relative font-ui text-sm font-medium no-underline whitespace-nowrap
              transition-colors duration-200
              ${active ? "text-ns-ink" : "text-ns-ink-secondary hover:text-ns-ink"}
              ${className}
            `}
          >
            {link.label}
            {active && (
              <span className="absolute -bottom-1.5 inset-x-0 h-0.5 rounded-full bg-ns-accent" />
            )}
          </Link>
        );
      })}
    </>
  );
};

export default NavLinks;
