import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import { useWalletState, WalletState } from "@/hooks/useWalletState";
import { generateUsername } from "@/utils/usernameGenerator";
import { validateImageFile } from "@/utils/imageUpload";
import { saveAiSettings, validateAiKey } from "@/cloudFunctions/aiSettings";
import { PROVIDERS, MODELS, type ProviderKey } from "@/config/aiProviders";
import { AI_SETTINGS_COPY, PLATFORM_AI_DAILY_LIMIT } from "@/config/aiQuota";

const INPUT_CLASS = `w-full px-4 py-3
 bg-ns-surface text-ns-ink
 border border-ns-border
 rounded-ns-lg
 focus:outline-none focus:border-ns-accent
 focus:ring-2 focus:ring-[var(--ns-ring)]
 transition-all duration-200
 placeholder:text-ns-ink-muted
 hover:border-ns-border-strong`;

const LABEL_CLASS =
  "block text-sm font-medium font-ui text-ns-ink mb-1 transition-colors duration-300";

const CompleteSignup: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — account
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 — profile (all optional)
  const [bio, setBio] = useState("");
  const [occupation, setOccupation] = useState("");
  const [location, setLocation] = useState("");
  const [writingInterests, setWritingInterests] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — optional BYOK (added only after the account exists & user is authed)
  const [aiProvider, setAiProvider] = useState<ProviderKey>("gemini");
  const [aiModel, setAiModel] = useState<string>(MODELS.gemini[0].value);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyTest, setKeyTest] = useState<"idle" | "testing" | "ok" | "fail">(
    "idle",
  );
  const [keyTestError, setKeyTestError] = useState("");
  const [keySave, setKeySave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { completeMagicLinkSignup, isMagicLink, error } = useFirebaseAuth();
  const {
    state: walletState,
    address: walletAddress,
    error: walletError,
    connectWallet,
    disconnectWallet,
    isConnecting,
    isDisconnecting,
  } = useWalletState();
  const navigate = useNavigate();

  useEffect(() => {
    const valid = isMagicLink();
    setIsValidLink(valid);

    if (!valid) {
      setLinkError(
        "This magic link is invalid or has expired. Please apply again.",
      );
    }

    const savedEmail = localStorage.getItem("emailForSignIn");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, [isMagicLink]);

  // Revoke object URL when the preview changes/unmounts to avoid leaks.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleGenerateUsername = () => {
    setUsername(generateUsername());
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }
    setImageError(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setImageError(null);
  };

  const validateStepOne = (): string | null => {
    if (!email.trim()) return "Please enter your email address.";
    if (!username.trim()) return "Please choose a username.";
    if (!password) return "Please enter a password.";
    if (password.length < 6)
      return "Password must be at least 6 characters long.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateStepOne();
    if (validationError) {
      setLinkError(validationError);
      return;
    }
    setLinkError(null);
    setStep(2);
  };

  const submitSignup = useCallback(async () => {
    setIsLoading(true);
    setLinkError(null);

    const result = await completeMagicLinkSignup(
      email.trim(),
      username.trim(),
      password,
      {
        bio,
        occupation,
        location,
        writingInterests,
        photoFile: photoFile ?? undefined,
      },
      walletAddress || undefined,
    );

    setIsLoading(false);

    if (result.success) {
      localStorage.removeItem("emailForSignIn");
      // Account now exists and the user is authenticated — offer optional BYOK.
      setStep(3);
    } else {
      setLinkError(result.message || "Failed to complete signup.");
    }
  }, [
    completeMagicLinkSignup,
    email,
    username,
    password,
    bio,
    occupation,
    location,
    writingInterests,
    photoFile,
    walletAddress,
    navigate,
  ]);

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSignup();
  };

  const handleAiProviderChange = (p: ProviderKey) => {
    setAiProvider(p);
    setAiModel(MODELS[p][0].value);
    setKeyTest("idle");
    setKeyTestError("");
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setKeyTest("testing");
    setKeyTestError("");
    const { valid, error } = await validateAiKey(aiProvider, apiKey.trim());
    if (valid) {
      setKeyTest("ok");
    } else {
      setKeyTest("fail");
      setKeyTestError(error || "Key validation failed.");
    }
  };

  const handleSaveKey = async () => {
    if (keyTest !== "ok") return;
    setKeySave("saving");
    try {
      await saveAiSettings({
        provider: aiProvider,
        apiKey: apiKey.trim(),
        model: aiModel || undefined,
      });
      setKeySave("saved");
      setApiKey("");
      // Brief confirmation, then finish.
      setTimeout(() => navigate("/"), 900);
    } catch {
      setKeySave("error");
    }
  };

  const finish = () => navigate("/");

  const handleWalletConnect = async () => {
    try {
      await connectWallet();
    } catch {
      // surfaced via walletError
    }
  };

  const handleWalletDisconnect = async () => {
    try {
      await disconnectWallet();
    } catch {
      // surfaced via walletError
    }
  };

  // Loading while verifying link.
  if (isValidLink === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-ns-bg">
        <div className="animate-spin h-8 w-8 border-4 border-ns-accent border-t-transparent rounded-full"></div>
        <p className="mt-4 text-ns-ink-secondary font-body">
          Verifying your magic link…
        </p>
      </div>
    );
  }

  // Invalid link.
  if (!isValidLink) {
    return (
      <>
        <SEOHead
          title={`Invalid Link - ${APP_NAME}`}
          description="The magic link is invalid or has expired."
          url="/auth/complete-signup"
          noindex={true}
          nofollow={true}
        />
        <div className="flex flex-col items-center justify-center h-full w-full bg-ns-bg transition-colors duration-300">
          <div className="w-full max-w-md p-8 bg-ns-elevated rounded-ns-2xl shadow-ns border border-ns-border">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-ns-destructive/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-ns-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-heading font-medium text-ns-ink mb-2">
                Invalid Link
              </h2>
              <p className="text-ns-ink-secondary font-body mb-6">
                {linkError || "This magic link is invalid or has expired."}
              </p>
              <button
                onClick={() => navigate("/sign-up")}
                className="w-full bg-ns-accent text-white font-ui font-semibold py-3 px-6 rounded-ns-lg shadow-ns-sm transition-all duration-300 hover:bg-ns-accent-hover"
              >
                Apply Again
              </button>
              <button
                onClick={() => navigate("/sign-in")}
                className="w-full mt-3 text-ns-accent font-ui font-semibold py-3 px-6 rounded-ns-lg border border-ns-border transition-all duration-300 hover:bg-ns-surface"
              >
                Sign In Instead
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={`Complete Registration - ${APP_NAME}`}
        description={`Complete your ${APP_NAME} registration and start your storytelling journey.`}
        url="/auth/complete-signup"
        noindex={true}
        nofollow={true}
      />
      <div className="flex flex-col items-center justify-center min-h-full w-full overflow-y-auto py-10 bg-ns-bg transition-colors duration-300">
        {/* Logo */}
        <div className="relative z-10 flex items-center text-center mb-6 animate-ns-fade-in">
          <h1 className="text-5xl font-heading font-medium text-ns-ink tracking-tight transition-colors duration-300">
            {APP_NAME}
          </h1>
        </div>

        <div
          className="relative z-10 w-full max-w-md p-8 bg-ns-elevated rounded-ns-2xl shadow-ns border border-ns-border transition-all duration-300 opacity-0 animate-ns-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? "w-8 bg-ns-accent"
                    : step > s
                      ? "w-8 bg-ns-accent/40"
                      : "w-4 bg-ns-border"
                }`}
              />
            ))}
          </div>

          <h2 className="text-3xl font-heading font-medium text-ns-ink mb-1 text-center">
            {step === 1
              ? "Welcome to the tribe!"
              : step === 2
                ? "Your author profile"
                : "AI writing assistant"}
          </h2>
          <p className="text-sm text-ns-ink-secondary font-body mb-6 text-center">
            {step === 1
              ? "Set up your account to get started"
              : step === 2
                ? "Tell readers a little about you — all optional, skip anytime."
                : "Optional — connect your own AI key now or add it later in Settings."}
          </p>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="The email you applied with"
                  className={INPUT_CLASS}
                />
                <p className="text-xs text-ns-ink-muted font-ui mt-1">
                  Use the same email address where you received the magic link.
                </p>
              </div>

              {/* Username */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="username" className={LABEL_CLASS}>
                    Username
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateUsername}
                    className="text-xs font-ui font-semibold text-ns-accent hover:text-ns-accent-hover transition-colors"
                  >
                    Generate one
                  </button>
                </div>
                <input
                  maxLength={20}
                  type="text"
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Choose a pen name"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className={LABEL_CLASS}>
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Create a password (min. 6 characters)"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirmPassword" className={LABEL_CLASS}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm your password"
                  className={INPUT_CLASS}
                />
              </div>

              {(linkError || error) && (
                <div className="text-ns-destructive text-sm font-ui mt-2 p-3 bg-ns-destructive/5 rounded-ns-lg border border-ns-destructive/20 animate-shake">
                  {linkError || error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-ns-accent text-white font-ui font-semibold py-3 px-6 rounded-ns-lg shadow-ns-sm transition-all duration-300 hover:bg-ns-accent-hover hover:shadow-ns active:scale-[0.98]"
              >
                Continue
              </button>
            </form>
          ) : step === 2 ? (
            <form onSubmit={handleFinalSubmit} className="space-y-5">
              {/* Profile image */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-ns-bg shadow-ns"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-ns-surface border-2 border-dashed border-ns-border flex items-center justify-center text-ns-ink-muted">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleSelectImage}
                  className="hidden"
                />
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-ui font-semibold text-ns-accent hover:text-ns-accent-hover transition-colors"
                  >
                    {photoPreview ? "Change photo" : "Add a profile photo"}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="text-xs font-ui font-semibold text-ns-ink-muted hover:text-ns-destructive transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {imageError && (
                  <p className="text-xs text-ns-destructive font-ui mt-2">
                    {imageError}
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="bio" className={LABEL_CLASS}>
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Write a little about yourself…"
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              {/* Occupation + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="occupation" className={LABEL_CLASS}>
                    Occupation
                  </label>
                  <input
                    id="occupation"
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    maxLength={50}
                    placeholder="What you do"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="location" className={LABEL_CLASS}>
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={50}
                    placeholder="Where you're based"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Writing interests */}
              <div>
                <label htmlFor="writingInterests" className={LABEL_CLASS}>
                  What do you want to write about?
                </label>
                <textarea
                  id="writingInterests"
                  value={writingInterests}
                  onChange={(e) => setWritingInterests(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Fantasy epics, cozy mysteries, heartfelt memoirs…"
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              {/* Wallet (optional) */}
              <div className="p-4 rounded-ns-lg border border-ns-border bg-ns-surface">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold font-ui text-ns-ink">
                      Wallet (optional)
                    </p>
                    <p className="text-xs text-ns-ink-secondary font-ui mt-1">
                      Connect now to receive tips, or set this up later from
                      your profile.
                    </p>
                  </div>
                  {walletAddress ? (
                    <button
                      type="button"
                      onClick={handleWalletDisconnect}
                      disabled={isDisconnecting}
                      className={`text-xs font-ui font-semibold px-3 py-1.5 rounded-ns border border-ns-border transition-colors ${
                        isDisconnecting
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleWalletConnect}
                      disabled={isConnecting}
                      className={`text-xs font-ui font-semibold px-3 py-1.5 rounded-ns bg-ns-accent text-white transition-all ${
                        isConnecting
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-ns-accent-hover"
                      }`}
                    >
                      {isConnecting ? "Connecting…" : "Connect Wallet"}
                    </button>
                  )}
                </div>

                {walletAddress && (
                  <p className="text-xs font-mono text-ns-ink-secondary mt-3 break-all">
                    Connected: {walletAddress}
                  </p>
                )}

                {walletState === WalletState.WRONG_NETWORK && (
                  <p className="text-xs text-ns-gold mt-2 font-ui">
                    Wallet connected on a different network. You can still
                    finish signup and change network later.
                  </p>
                )}

                {walletError && (
                  <p className="text-xs text-ns-destructive mt-2 font-ui">
                    {walletError.message}
                  </p>
                )}
              </div>

              {(linkError || error) && (
                <div className="text-ns-destructive text-sm font-ui mt-2 p-3 bg-ns-destructive/5 rounded-ns-lg border border-ns-destructive/20 animate-shake">
                  {linkError || error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                  className="flex-shrink-0 text-ns-ink-secondary font-ui font-semibold py-3 px-5 rounded-ns-lg border border-ns-border transition-all duration-300 hover:bg-ns-surface disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 bg-ns-accent text-white font-ui font-semibold py-3 px-6 rounded-ns-lg shadow-ns-sm transition-all duration-300 ${
                    isLoading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-ns-accent-hover hover:shadow-ns active:scale-[0.98]"
                  }`}
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
                      Creating your account…
                    </span>
                  ) : (
                    "Complete Registration"
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={submitSignup}
                disabled={isLoading}
                className="w-full text-center text-sm text-ns-ink-muted font-ui hover:text-ns-ink-secondary transition-colors disabled:opacity-50"
              >
                Skip for now — I'll fill this in later
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {/* What BYOK does / doesn't do */}
              <div className="rounded-ns-lg border border-ns-border bg-ns-surface p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold font-ui text-ns-ink mb-0.5">
                    Without your own key
                  </p>
                  <p className="text-xs text-ns-ink-secondary font-body leading-relaxed">
                    You use {AI_SETTINGS_COPY.platformLabel} — a shared daily
                    allowance of {PLATFORM_AI_DAILY_LIMIT} AI requests,
                    resetting at midnight UTC. Perfect for getting started, no
                    setup needed.
                  </p>
                </div>
                <div className="h-px bg-ns-border" />
                <div>
                  <p className="text-sm font-semibold font-ui text-ns-ink mb-0.5">
                    With your own key
                  </p>
                  <p className="text-xs text-ns-ink-secondary font-body leading-relaxed">
                    No {AI_SETTINGS_COPY.platformLabel} daily limit — usage is
                    billed directly by your provider. Your key is encrypted and
                    used only for your AI requests.
                  </p>
                </div>
              </div>

              {/* Provider */}
              <div>
                <p className={LABEL_CLASS}>AI Provider</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PROVIDERS) as ProviderKey[]).map((p) => {
                    const selected = aiProvider === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleAiProviderChange(p)}
                        className={`flex flex-col items-start p-3 rounded-ns border text-left transition-all ${
                          selected
                            ? "border-ns-accent bg-ns-accent-subtle"
                            : "border-ns-border bg-ns-surface hover:border-ns-border-strong"
                        }`}
                      >
                        <span
                          className={`text-sm font-semibold font-ui ${
                            selected ? "text-ns-accent" : "text-ns-ink"
                          }`}
                        >
                          {PROVIDERS[p].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model */}
              <div>
                <label htmlFor="aiModel" className={LABEL_CLASS}>
                  Model
                </label>
                <select
                  id="aiModel"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {MODELS[aiProvider].map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* API key */}
              <div>
                <label htmlFor="apiKey" className={LABEL_CLASS}>
                  API Key
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyTest("idle");
                      setKeyTestError("");
                    }}
                    placeholder="Paste your API key here"
                    className={`${INPUT_CLASS} pr-16`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-ui font-semibold text-ns-ink-muted hover:text-ns-ink"
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
                {keyTest === "ok" && (
                  <p className="text-xs text-ns-accent font-ui mt-1">
                    Connection successful — key is valid.
                  </p>
                )}
                {keyTest === "fail" && (
                  <p className="text-xs text-ns-destructive font-ui mt-1">
                    {keyTestError ||
                      "Connection failed. Check your key and try again."}
                  </p>
                )}
              </div>

              {/* Test + Save */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={!apiKey.trim() || keyTest === "testing"}
                  className="flex-1 font-ui font-semibold py-3 px-4 rounded-ns-lg border border-ns-border text-ns-ink transition-all hover:bg-ns-surface disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {keyTest === "testing" ? "Testing…" : "Test Connection"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={keyTest !== "ok" || keySave === "saving"}
                  className="flex-1 bg-ns-accent text-white font-ui font-semibold py-3 px-4 rounded-ns-lg shadow-ns-sm transition-all hover:bg-ns-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {keySave === "saving"
                    ? "Saving…"
                    : keySave === "saved"
                      ? "Saved!"
                      : "Save & Finish"}
                </button>
              </div>

              {keySave === "error" && (
                <p className="text-xs text-ns-destructive font-ui">
                  Couldn't save your key. You can add it later in Settings.
                </p>
              )}

              <button
                type="button"
                onClick={finish}
                className="w-full text-center text-sm text-ns-ink-muted font-ui hover:text-ns-ink-secondary transition-colors"
              >
                Skip for now — I'll add this later in Settings
              </button>
            </div>
          )}

          {step !== 3 && (
            <div className="text-center mt-6">
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
          )}
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

export default CompleteSignup;
