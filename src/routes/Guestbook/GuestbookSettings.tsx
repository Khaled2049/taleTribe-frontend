import React from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useGuestbookPolicy } from "@/hooks/queries/useUserQueries";
import { SEOHead } from "@/components/seo/SEOHead";
import GuestbookTabs from "@/components/guestbook/GuestbookTabs";
import WallPolicySelect from "@/components/guestbook/WallPolicySelect";

/**
 * Settings for your own guestbook. The route carries no uid — these are always
 * the signed-in user's, never the wall you happen to be reading.
 */
const GuestbookSettings: React.FC = () => {
  const { user, loading: authLoading } = useAuthContext();
  const { data: guestbookPolicy, isLoading: policyLoading } = useGuestbookPolicy(user?.uid);

  if (authLoading || (user && policyLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="bg-ns-elevated border border-ns-border rounded-ns-xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-ns-surface border border-ns-border flex items-center justify-center">
            <User className="w-6 h-6 text-ns-ink-muted" />
          </div>
          <h1 className="font-heading text-xl text-ns-ink mb-2">
            Sign in to manage your guestbook
          </h1>
          <Link
            to="/sign-in"
            className="inline-flex items-center justify-center px-4 py-2 rounded-ns bg-ns-accent text-white font-ui text-sm hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title="Guestbook settings" noindex />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="font-heading text-3xl sm:text-4xl text-ns-ink leading-none mb-6">
          Guestbook settings
        </h1>

        <GuestbookTabs active="settings" wallUserId={user.uid} />

        <WallPolicySelect
          userId={user.uid}
          current={guestbookPolicy}
        />
      </div>
    </div>
  );
};

export default GuestbookSettings;
