import React, { useState } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Signup: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { requestInvite } = useFirebaseAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await requestInvite(trimmed);

    setIsLoading(false);

    if (result.success) {
      // Save email to localStorage for use when completing signup
      localStorage.setItem("emailForSignIn", trimmed);
      setIsSuccess(true);
    } else {
      setErrorMessage(result.message || "Failed to submit your application.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  // Success state - application submitted
  if (isSuccess) {
    return (
      <>
        <SEOHead
          title={`Application Submitted - ${APP_NAME}`}
          description="Your author application has been submitted."
          url="/sign-up"
          noindex={true}
          nofollow={true}
        />
        <div className="flex flex-col items-center justify-center h-full w-full overflow-hidden bg-ns-bg transition-colors duration-300">
          <div className="relative z-10 flex items-center text-center mb-8 animate-ns-fade-in">
            <h1 className="text-5xl font-heading font-medium text-ns-ink tracking-tight transition-colors duration-300">
              {APP_NAME}
            </h1>
          </div>

          <div
            className="relative z-10 w-full max-w-md p-8 bg-ns-elevated rounded-ns-2xl shadow-ns border border-ns-border transition-all duration-300 opacity-0 animate-ns-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-ns-accent-subtle rounded-full flex items-center justify-center opacity-0 animate-ns-fade-in">
                <svg
                  className="w-8 h-8 text-ns-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h2
                className="text-2xl font-heading font-medium text-ns-ink mb-2 opacity-0 animate-ns-fade-in"
                style={{ animationDelay: "0.1s" }}
              >
                Application Submitted
              </h2>

              <p
                className="text-ns-ink-secondary font-body mb-6 opacity-0 animate-ns-fade-in"
                style={{ animationDelay: "0.2s" }}
              >
                We've received your author application for{" "}
                <span className="font-semibold text-ns-accent">{email}</span>.
              </p>

              <p
                className="text-sm text-ns-ink-muted font-body mb-6 opacity-0 animate-ns-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                When you're welcomed into the tribe, you'll receive an email
                with a magic link to set up your author profile. Keep an eye on
                your inbox!
              </p>

              <div
                className="space-y-3 opacity-0 animate-ns-fade-in"
                style={{ animationDelay: "0.4s" }}
              >
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                  }}
                  className="w-full bg-ns-surface text-ns-ink-secondary font-ui font-semibold py-3 px-6 rounded-ns-lg border border-ns-border transition-all duration-300 hover:bg-ns-surface-hover hover:text-ns-ink"
                >
                  Apply with another email
                </button>

                <button
                  onClick={() => navigate("/sign-in")}
                  className="w-full text-ns-accent font-ui font-semibold py-3 px-6 rounded-ns-lg border border-ns-border transition-all duration-300 hover:bg-ns-surface"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={`Apply to be an Author - ${APP_NAME}`}
        description={`Apply to become an author on ${APP_NAME} and start writing stories with AI assistance.`}
        url="/sign-up"
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

        {/* Application Form Container */}
        <div
          className="relative z-10 w-full max-w-md p-8 bg-ns-elevated rounded-ns-2xl shadow-ns border border-ns-border transition-all duration-300 opacity-0 animate-ns-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <h2 className="text-3xl font-heading font-medium text-ns-ink mb-2 transition-colors duration-300">
            Apply to be an Author
          </h2>
          <p className="text-sm text-ns-ink-secondary font-body mb-6">
            Join the {APP_NAME} community of storytellers
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div
              className="opacity-0 animate-ns-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium font-ui text-ns-ink mb-1 transition-colors duration-300"
              >
                Email Address
              </label>
              <input
                maxLength={100}
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              <p className="text-xs text-ns-ink-muted font-ui mt-2">
                You'll receive a magic link to this email once you're welcomed
                into the tribe.
              </p>
            </div>

            {errorMessage && (
              <div className="text-ns-destructive text-sm font-ui mt-2 p-3 bg-ns-destructive/5 rounded-ns-lg border border-ns-destructive/20 animate-shake">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-ns-accent text-white font-ui font-semibold py-3 px-6 rounded-ns-lg shadow-ns-sm transition-all duration-300 opacity-0 animate-ns-fade-in ${
                isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-ns-accent-hover hover:shadow-ns active:scale-[0.98]"
              }`}
              style={{ animationDelay: "0.3s" }}
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
                  Submitting...
                </span>
              ) : (
                "Apply"
              )}
            </button>
          </form>

          {/* Info box */}
          <div
            className="mt-6 p-4 bg-ns-surface rounded-ns-lg border border-ns-border opacity-0 animate-ns-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <h3 className="text-sm font-semibold font-ui text-ns-ink mb-2">
              How it works
            </h3>
            <ol className="text-xs text-ns-ink-secondary font-ui space-y-1.5 list-decimal list-inside">
              <li>Submit your email address above</li>
              <li>Wait to be welcomed into the tribe</li>
              <li>Click the magic link in your email</li>
              <li>Set up your author profile and start writing!</li>
            </ol>
          </div>

          <div
            className="text-center mt-6 opacity-0 animate-ns-fade-in"
            style={{ animationDelay: "0.5s" }}
          >
            <span className="text-ns-ink-secondary text-sm font-ui">
              Already have an account?{" "}
            </span>
            <button
              onClick={() => navigate("/sign-in")}
              className="text-ns-accent hover:text-ns-accent-hover transition-colors duration-200 font-ui font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Decorative quote */}
        <div
          className="relative z-10 mt-8 text-center text-xs text-ns-ink-muted opacity-0 animate-ns-fade-in"
          style={{ animationDelay: "0.6s" }}
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

export default Signup;
