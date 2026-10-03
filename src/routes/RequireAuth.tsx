import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthIdentity } from "@novelsync/platform-auth";

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Gates member-only sections without losing the visitor's destination. The
 * sign-in page validates and consumes this relative redirect after login.
 *
 * Gates on the Firebase identity rather than the hydrated profile in
 * authStore: that store reports `user: null` until the profile and follow
 * graph load, which would hold the page back behind reads it does not need.
 * Children must therefore not assume `useAuthContext().user` is set yet.
 */
const RequireAuth = ({ children }: RequireAuthProps) => {
  const identity = useAuthIdentity();
  const location = useLocation();

  if (identity.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-ns-bg">
        <Loader2
          className="h-7 w-7 animate-spin text-ns-accent"
          aria-label="Checking sign-in status"
        />
      </div>
    );
  }

  if (!identity.isSignedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/sign-in?redirect=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
};

export default RequireAuth;
