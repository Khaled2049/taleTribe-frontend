import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getCurrentUid, useAuthIdentity } from "@novelsync/platform-auth";
import { useAuthContext } from "@/contexts/AuthContext";
import RequireAuth from "@/routes/RequireAuth";

function AdminClaim({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext();
  const identity = useAuthIdentity();
  if (
    loading ||
    identity.loading ||
    identity.uid !== getCurrentUid() ||
    (user && user.uid !== identity.uid)
  ) {
    return (
      <p role="status" className="p-8 text-ns-ink-secondary">
        Checking admin access…
      </p>
    );
  }
  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-ns-ink">
        <h1 className="font-heading text-3xl">Admin access required</h1>
        <p className="mt-3 text-ns-ink-secondary">
          Your account does not have permission to use the admin pages.
        </p>
        <Link to="/" className="mt-6 inline-block text-ns-accent underline">
          Return home
        </Link>
      </div>
    );
  }
  return children;
}

export default function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminClaim>{children}</AdminClaim>
    </RequireAuth>
  );
}
