import { useState, type FormEvent } from "react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "@novelsync/platform-auth";
import { openExternal } from "../openExternal";

/** Only in-app relative paths, never absolute URLs (open-redirect guard). */
const safeRedirect = (raw: string | null): string =>
  raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/shelf";

const INPUT =
  "w-full px-4 py-3 bg-ns-surface text-ns-ink border border-ns-border rounded-ns-lg text-base font-ui focus:outline-none focus:border-ns-accent focus:ring-2 focus:ring-[var(--ns-ring)] placeholder:text-ns-ink-muted";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(safeRedirect(searchParams.get("redirect")), { replace: true });
    } catch {
      setPassword("");
      setError("Invalid email or password.");
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email first, then tap “Forgot password”.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Same message either way, so the form does not reveal which emails exist.
    }
    setNotice("If that email has an account, a reset link is on its way.");
  };

  return (
    <div className="flex min-h-full flex-col justify-center bg-ns-bg px-6 py-10">
      <h1 className="font-heading text-4xl font-medium text-ns-ink">Sign in</h1>
      <p className="mb-8 mt-2 font-body text-ns-ink-secondary">
        Pick up where you left off, on any device.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block font-ui text-sm font-medium text-ns-ink"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block font-ui text-sm font-medium text-ns-ink"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </div>

        {error && (
          <p role="alert" className="font-ui text-sm text-ns-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="font-ui text-sm text-ns-ink-secondary">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-ns bg-ns-accent px-5 py-3 font-ui text-base font-medium text-white transition-colors active:bg-ns-accent-hover disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 font-ui text-sm">
        <button onClick={handleReset} className="text-ns-ink-secondary">
          Forgot password?
        </button>
        <button
          onClick={() => void openExternal("/sign-up")}
          className="text-ns-accent"
        >
          New here? Request an invite on the website
        </button>
      </div>
    </div>
  );
};

export default SignIn;
