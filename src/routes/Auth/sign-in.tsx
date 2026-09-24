import React, { useState } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";

/** Only same-origin relative paths — never absolute URLs (open-redirect guard). */
const safeRedirect = (raw: string | null): string => {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
};

const Signin: React.FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signin } = useFirebaseAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await signin(formData.email, formData.password);
    if (res.status === 200) {
      navigate(safeRedirect(searchParams.get("redirect")));
    } else {
      setFormData({ email: "", password: "" });
      setIsLoading(false);
      setError("Invalid username or password");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <>
      <SEOHead
        title={`Sign In - ${APP_NAME}`}
        description={`Sign in to your ${APP_NAME} account to continue writing, reading, and connecting with the writing community.`}
        url="/sign-in"
        noindex={true}
        nofollow={true}
      />
      <div className="flex flex-col items-center justify-center h-full w-full overflow-hidden bg-ns-bg transition-colors duration-300">
        {/* Logo */}
        <div className="relative z-10 flex items-center text-center mb-8 animate-ns-fade-in">
          <h1 className="text-5xl font-heading font-medium text-ns-ink tracking-tight transition-colors duration-300">
            {APP_NAME}
          </h1>
        </div>

        {/* Sign In Form Container */}
        <div
          className="relative z-10 w-full max-w-md p-8 bg-ns-elevated rounded-ns-2xl shadow-ns border border-ns-border transition-all duration-300 opacity-0 animate-ns-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <h2 className="text-3xl font-heading font-medium text-ns-ink mb-2 transition-colors duration-300">
            Sign In
          </h2>
          <p className="text-sm text-ns-ink-secondary font-body mb-6">
            Continue your storytelling journey
          </p>

          <div className="space-y-5">
            <div
              className="opacity-0 animate-ns-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium font-ui text-ns-ink mb-1 transition-colors duration-300"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                data-cy="email"
                value={formData.email}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                required
                className="w-full px-4 py-3
                 bg-ns-surface text-ns-ink
                 border border-ns-border
                 rounded-ns-lg
                 focus:outline-none focus:border-ns-accent
                 focus:ring-2 focus:ring-[var(--ns-ring)]
                 transition-all duration-200
                 placeholder:text-ns-ink-muted
                 hover:border-ns-border-strong"
                placeholder="your@email.com"
              />
            </div>

            <div
              className="opacity-0 animate-ns-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              <label
                htmlFor="password"
                className="block text-sm font-medium font-ui text-ns-ink mb-1 transition-colors duration-300"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                data-cy="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                required
                className="w-full px-4 py-3
                 bg-ns-surface text-ns-ink
                 border border-ns-border
                 rounded-ns-lg
                 focus:outline-none focus:border-ns-accent
                 focus:ring-2 focus:ring-[var(--ns-ring)]
                 transition-all duration-200
                 placeholder:text-ns-ink-muted
                 hover:border-ns-border-strong"
                placeholder="••••••••"
              />
            </div>

            <div
              className="text-left opacity-0 animate-ns-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              <button
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-ns-accent hover:text-ns-accent-hover transition-colors duration-200 font-ui font-medium hover:underline bg-transparent border-none cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="text-ns-destructive text-sm mt-2 p-3 bg-ns-destructive/5 rounded-ns-lg border border-ns-destructive/20 animate-shake">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              data-cy="signin-submit"
              disabled={isLoading}
              className={`w-full bg-ns-accent text-white font-ui font-semibold py-3 px-6 rounded-ns-lg shadow-ns-sm transition-all duration-300 opacity-0 animate-ns-fade-in ${
                isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-ns-accent-hover hover:shadow-ns active:scale-[0.98]"
              }`}
              style={{ animationDelay: "0.5s" }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing In...
                </span>
              ) : (
                "Sign In"
              )}
            </button>

            <div
              className="text-center mt-6 opacity-0 animate-ns-fade-in"
              style={{ animationDelay: "0.6s" }}
            >
              <span className="text-ns-ink-secondary text-sm font-ui">
                Don't have an account?{" "}
              </span>
              <button
                onClick={() => navigate("/sign-up")}
                className="text-ns-accent hover:text-ns-accent-hover transition-colors duration-200 font-ui font-semibold hover:underline bg-transparent border-none cursor-pointer"
              >
                Apply to be an Author
              </button>
            </div>
          </div>
        </div>

        {/* Decorative quote */}
        <div
          className="relative z-10 mt-8 text-center text-xs text-ns-ink-muted opacity-0 animate-ns-fade-in"
          style={{ animationDelay: "0.7s" }}
        >
          <p className="italic font-body">
            "Every great story begins with a single word"
          </p>
        </div>

        <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        `}</style>
      </div>
    </>
  );
};
export default Signin;
