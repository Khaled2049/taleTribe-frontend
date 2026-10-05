import {
  isRouteErrorResponse,
  useRouteError,
  useNavigate,
} from "react-router-dom";
import { AlertCircle, Home, RotateCw } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";

/**
 * Route-level error element (wired via `errorElement` in main.tsx).
 * Handles both thrown render/loader errors and route responses such as 404s,
 * replacing React Router's bare-bones default error screen.
 */
export const RouteError = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  const title = isNotFound ? "Page not found" : "Something went wrong";
  const blurb = isNotFound
    ? "This page seems to have wandered off — the link may be broken or the story moved."
    : "An unexpected error interrupted this page. You can try again, or head back home.";

  // Surface the underlying message in dev to aid debugging; keep it quiet in prod.
  const detail = import.meta.env.DEV
    ? isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : error instanceof Error
        ? error.message
        : null
    : null;

  return (
    <div className="min-h-screen bg-ns-bg flex items-center justify-center px-6">
      {/* Hosting answers 200 for any path, so this is what stops an unknown
          URL being indexed as a copy of the home page. */}
      <SEOHead title={title} noindex />
      <div className="text-center flex flex-col items-center gap-5 max-w-md animate-ns-fade-in">
        <div className="w-16 h-16 rounded-full bg-ns-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-ns-destructive" />
        </div>

        {isNotFound && (
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ns-ink-muted">
            Error 404
          </p>
        )}

        <div className="space-y-2">
          <h1 className="font-heading text-3xl text-ns-ink">{title}</h1>
          <p className="font-body text-base text-ns-ink-secondary leading-relaxed">
            {blurb}
          </p>
        </div>

        {detail && (
          <pre className="w-full max-w-md overflow-x-auto rounded-ns bg-ns-surface border border-ns-border px-3 py-2 text-left font-mono text-xs text-ns-ink-muted">
            {detail}
          </pre>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {!isNotFound && (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-ns-accent text-white font-ui text-sm rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
            >
              <RotateCw className="w-4 h-4" />
              Try again
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            className={`inline-flex items-center gap-2 px-4 py-2 font-ui text-sm rounded-ns active:scale-[0.97] transition-all duration-150 ${
              isNotFound
                ? "bg-ns-accent text-white hover:bg-ns-accent-hover"
                : "bg-ns-surface text-ns-ink border border-ns-border hover:bg-ns-surface-hover"
            }`}
          >
            <Home className="w-4 h-4" />
            Back home
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteError;
