import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Gates member-only sections without losing the visitor's destination. The
 * sign-in page validates and consumes this relative redirect after login.
 */
const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-ns-bg">
        <Loader2
          className="h-7 w-7 animate-spin text-ns-accent"
          aria-label="Checking sign-in status"
        />
      </div>
    );
  }

  if (!user) {
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
