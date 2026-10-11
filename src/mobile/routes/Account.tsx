import { signOut } from "firebase/auth";
import { ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { auth, useAuthIdentity } from "@novelsync/platform-auth";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { openExternal } from "../openExternal";

const ROW =
  "flex w-full items-center justify-between px-4 py-3.5 font-ui text-base text-ns-ink text-left";

const WEB_LINKS = [
  { label: "Write on the website", path: "/user-stories" },
  { label: "Help & support", path: "/help" },
  { label: "Privacy policy", path: "/privacy-policy" },
  { label: "Terms of use", path: "/terms-of-use" },
] as const;

const Account = () => {
  const identity = useAuthIdentity();
  const { user } = useAuthContext();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-full bg-ns-bg px-4 pb-10 pt-6 text-ns-ink">
      <h1 className="mb-6 font-heading text-display leading-none text-ns-ink">
        Account
      </h1>

      <section className="mb-6 rounded-ns-lg border border-ns-border bg-ns-surface p-4">
        {identity.loading ? (
          <Loader2
            className="h-6 w-6 animate-spin text-ns-accent"
            aria-label="Checking sign-in status"
          />
        ) : identity.isSignedIn ? (
          <>
            <p className="font-heading text-2xl text-ns-ink">
              {user?.username || "Signed in"}
            </p>
            <p className="mt-0.5 font-ui text-sm text-ns-ink-secondary">
              {identity.email}
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 font-ui text-sm text-ns-ink-secondary">
              You’re reading as a guest. Sign in to sync your progress.
            </p>
            <Link
              to="/sign-in?redirect=%2Faccount"
              className="inline-flex rounded-ns bg-ns-accent px-5 py-2.5 font-ui text-sm font-medium text-white no-underline"
            >
              Sign in
            </Link>
          </>
        )}
      </section>

      <section className="mb-6 divide-y divide-ns-border overflow-hidden rounded-ns-lg border border-ns-border bg-ns-surface">
        <button onClick={toggleTheme} className={ROW}>
          Appearance
          <span className="text-ns-ink-secondary">
            {theme === "dark" ? "Dark" : "Light"}
          </span>
        </button>
        {WEB_LINKS.map(({ label, path }) => (
          <button
            key={path}
            onClick={() => void openExternal(path)}
            className={ROW}
          >
            {label}
            <ChevronRight className="h-5 w-5 text-ns-ink-muted" />
          </button>
        ))}
      </section>

      {identity.isSignedIn && (
        <button
          onClick={() => void signOut(auth)}
          className="w-full rounded-ns border border-ns-border px-5 py-3 font-ui text-base text-ns-destructive"
        >
          Sign out
        </button>
      )}
    </div>
  );
};

export default Account;
