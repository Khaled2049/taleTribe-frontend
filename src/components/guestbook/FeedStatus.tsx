import React from "react";
import { RefreshCw } from "lucide-react";

interface FeedRefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  className?: string;
}

/**
 * Guestbooks have no live subscription and focus refetch is off, so without
 * this a mounted feed stays as old as its last navigation.
 */
export const FeedRefreshButton: React.FC<FeedRefreshButtonProps> = ({
  onRefresh,
  isRefreshing,
  className = "",
}) => (
  <button
    type="button"
    onClick={onRefresh}
    disabled={isRefreshing}
    className={`inline-flex items-center gap-1.5 font-ui text-[12.5px] font-semibold text-ns-ink-muted hover:text-ns-ink transition-colors disabled:hover:text-ns-ink-muted ${className}`}
  >
    <RefreshCw
      size={13}
      className={isRefreshing ? "animate-spin" : undefined}
      aria-hidden="true"
    />
    <span aria-live="polite">{isRefreshing ? "Updating…" : "Refresh"}</span>
  </button>
);

interface FeedErrorProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}

export const FeedError: React.FC<FeedErrorProps> = ({
  message,
  onRetry,
  isRetrying,
}) => (
  <div
    role="alert"
    className="flex items-center gap-3 px-4 py-3 bg-ns-accent-subtle border border-ns-destructive/20 rounded-ns font-ui text-sm text-ns-destructive"
  >
    <span className="flex-1 min-w-0">{message}</span>
    <button
      type="button"
      onClick={onRetry}
      disabled={isRetrying}
      className="flex-shrink-0 font-semibold underline disabled:opacity-50"
    >
      {isRetrying ? "Retrying…" : "Try again"}
    </button>
  </div>
);
