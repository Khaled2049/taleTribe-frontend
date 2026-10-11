import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { openExternal } from "../openExternal";

/**
 * Catches every path the app has no screen for (profiles, guestbooks, the
 * studio) so links inside shared components open the website instead of a 404.
 */
const ExternalLink = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void openExternal(`${location.pathname}${location.search}${location.hash}`);
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/stories", { replace: true });
  }, [location, navigate]);

  return (
    <div className="flex min-h-full items-center justify-center bg-ns-bg px-6">
      <p className="font-ui text-sm text-ns-ink-secondary">
        Opening on the website…
      </p>
    </div>
  );
};

export default ExternalLink;
