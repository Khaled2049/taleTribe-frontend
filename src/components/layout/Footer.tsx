import { Link } from "react-router-dom";
import PeekingCat from "./PeekingCat";

const Footer: React.FC = () => {
  return (
    <div className="relative">
      <PeekingCat />
      <footer className="relative z-10 bg-ns-surface border-t border-ns-border py-4 sm:py-6 transition-colors duration-200">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center gap-1.5 sm:gap-3">
          {/* Mobile: links + credit all on one line */}
          <div className="sm:hidden flex items-center gap-3 text-xs font-ui">
            <Link
              to="/privacy-policy"
              className="text-ns-accent hover:text-ns-accent-hover hover:underline"
            >
              Privacy Policy
            </Link>
            <span className="text-ns-border-strong" aria-hidden="true">
              ·
            </span>
            <Link
              to="/terms-of-use"
              className="text-ns-accent hover:text-ns-accent-hover hover:underline"
            >
              Terms of Use
            </Link>
            <span className="text-ns-border-strong" aria-hidden="true">
              ·
            </span>
            <a
              href="https://khaled.codexn.com"
              target="_blank"
              rel="noreferrer"
              className="text-ns-ink-muted hover:text-ns-accent-hover hover:underline whitespace-nowrap"
            >
              Created by Khaled Hossain
            </a>
          </div>

          {/* Desktop: full notice sentence */}
          <p className="hidden sm:block text-center text-sm text-ns-ink-secondary font-ui">
            By your continued use of this site, you accept such use. See our{" "}
            <Link
              to="/privacy-policy"
              className="text-ns-accent hover:text-ns-accent-hover hover:underline"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              to="/terms-of-use"
              className="text-ns-accent hover:text-ns-accent-hover hover:underline"
            >
              Terms of Use
            </Link>
            .
          </p>
          <p className="hidden sm:block text-center text-sm text-ns-ink-muted font-ui">
            Created by{" "}
            <a
              href="https://khaled.codexn.com"
              target="_blank"
              rel="noreferrer"
              className="text-ns-accent hover:text-ns-accent-hover hover:underline"
            >
              Khaled Hossain
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Footer;
