import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Key,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/contexts/AuthContext";
import { firestore } from "@novelsync/platform-auth";
import {
  deleteAiSettings,
  saveAiSettings,
  validateAiKey,
} from "@/cloudFunctions/aiSettings";
import {
  AI_SETTINGS_COPY,
  PLATFORM_AI_DAILY_LIMIT,
  getPlatformAiRemaining,
  getTodayPlatformAiUsage,
} from "@/config/aiQuota";
import { PROVIDERS, MODELS, type ProviderKey } from "@/config/aiProviders";

interface QuotaSnapshot {
  aiUsage: number;
  lastAiUsageDate: string;
}

// ── Component ──────────────────────────────────────────────────────────────
const AiSettings = () => {
  const { user } = useAuthContext();

  const [provider, setProvider] = useState<ProviderKey>("gemini");
  const [model, setModel] = useState<string>(MODELS.gemini[0].value);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [testError, setTestError] = useState("");

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [removeState, setRemoveState] = useState<"idle" | "removing">("idle");

  // Track local BYOK status (mirrors user.hasCustomAiProvider but updated on save/remove)
  const [isActive, setIsActive] = useState(!!user?.hasCustomAiProvider);
  const [quotaSnapshot, setQuotaSnapshot] = useState<QuotaSnapshot | null>(
    null,
  );

  const effectiveAiUsage = quotaSnapshot?.aiUsage ?? user?.aiUsage;
  const effectiveLastAiUsageDate =
    quotaSnapshot?.lastAiUsageDate ?? user?.lastAiUsageDate;
  const usedToday = useMemo(
    () => getTodayPlatformAiUsage(effectiveAiUsage, effectiveLastAiUsageDate),
    [effectiveAiUsage, effectiveLastAiUsageDate],
  );
  const requestsRemaining = useMemo(
    () => getPlatformAiRemaining(effectiveAiUsage, effectiveLastAiUsageDate),
    [effectiveAiUsage, effectiveLastAiUsageDate],
  );
  const usagePercent = useMemo(() => {
    if (PLATFORM_AI_DAILY_LIMIT <= 0) return 0;
    return Math.min(
      100,
      Math.round((usedToday / PLATFORM_AI_DAILY_LIMIT) * 100),
    );
  }, [usedToday]);

  useEffect(() => {
    setIsActive(!!user?.hasCustomAiProvider);
  }, [user?.hasCustomAiProvider]);

  useEffect(() => {
    if (!user?.uid) {
      setQuotaSnapshot(null);
      return;
    }

    let isMounted = true;
    const refreshQuotaSnapshot = async () => {
      try {
        const userRef = doc(firestore, "users", user.uid);
        const snapshot = await getDoc(userRef);
        if (!snapshot.exists() || !isMounted) return;

        const data = snapshot.data();
        setQuotaSnapshot({
          aiUsage: typeof data.aiUsage === "number" ? data.aiUsage : 0,
          lastAiUsageDate:
            typeof data.lastAiUsageDate === "string"
              ? data.lastAiUsageDate
              : "",
        });
      } catch (error) {
        console.error("Failed to refresh AI usage snapshot:", error);
      }
    };

    refreshQuotaSnapshot();
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const handleProviderChange = (p: ProviderKey) => {
    setProvider(p);
    setModel(MODELS[p][0].value);
    setTestState("idle");
    setTestError("");
  };

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTestState("testing");
    setTestError("");
    const { valid, error } = await validateAiKey(provider, apiKey.trim());
    if (valid) {
      setTestState("ok");
    } else {
      setTestState("fail");
      setTestError(error || "Key validation failed");
    }
  };

  const handleSave = async () => {
    if (testState !== "ok") return;
    setSaveState("saving");
    try {
      await saveAiSettings({
        provider,
        apiKey: apiKey.trim(),
        model: model || undefined,
      });
      setSaveState("saved");
      setIsActive(true);
      setApiKey(""); // never keep in state after save
      setTestState("idle");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  };

  const handleRemove = async () => {
    setRemoveState("removing");
    try {
      await deleteAiSettings();
      setIsActive(false);
      setTestState("idle");
      setApiKey("");
    } catch (error) {
      console.error("Failed to remove AI settings:", error);
    } finally {
      setRemoveState("idle");
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-black/10 dark:border-white/10 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-6 h-6 text-dark-green dark:text-light-green" />
        <h2 className="text-2xl font-semibold font-heading">AI Provider</h2>
      </div>

      {/* Current status */}
      <div className="mb-6 p-4 rounded-lg border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-black">
        <p className="text-xs font-ui text-black/50 dark:text-white/50 uppercase tracking-wider mb-1">
          Current Status
        </p>
        <p className="text-xs text-black/60 dark:text-white/60 font-body mb-3">
          Choose NovelSync&apos;s shared AI quota or connect your own provider
          key.
        </p>
        {isActive ? (
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-dark-green dark:text-light-green shrink-0" />
              <span className="text-sm font-body text-black dark:text-white">
                Your{" "}
                <span className="font-semibold capitalize">{provider}</span> key
                {" — "}
                billed by{" "}
                <span className="font-semibold capitalize">{provider}</span>,
                not NovelSync
              </span>
            </div>
            <p className="mt-2 text-xs text-black/60 dark:text-white/60 font-body">
              {AI_SETTINGS_COPY.byokNoLimitHint}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-black/40 dark:text-white/40 shrink-0" />
              <span className="text-sm font-body text-black/70 dark:text-white/70">
                {AI_SETTINGS_COPY.platformLabel} — {usedToday} of{" "}
                {PLATFORM_AI_DAILY_LIMIT} requests used today
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-dark-green dark:bg-light-green transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-black/60 dark:text-white/60 font-body">
              {AI_SETTINGS_COPY.platformResetHint}
            </p>
            {requestsRemaining <= 0 ? (
              <p className="mt-2 text-xs text-red-500 font-body">
                Daily limit reached. Add your own API key below to keep using
                AI, or try again after midnight UTC.
              </p>
            ) : (
              <p className="mt-2 text-xs text-black/60 dark:text-white/60 font-body">
                {requestsRemaining} requests remaining today.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Provider selector */}
      <div className="mb-5">
        <p className="text-sm font-ui font-medium text-black dark:text-white mb-3">
          Select Provider
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(PROVIDERS) as ProviderKey[]).map((p) => {
            const meta = PROVIDERS[p];
            const selected = provider === p;
            return (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={[
                  "relative flex flex-col items-start p-4 rounded-lg border text-left transition-all duration-150",
                  selected
                    ? `${meta.border} ${meta.bg} ring-1 ring-inset ${meta.border}`
                    : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-neutral-50 dark:bg-black",
                ].join(" ")}
              >
                {selected && (
                  <span
                    className={`absolute top-2 right-2 w-2 h-2 rounded-full ${meta.accent.replace("text-", "bg-")}`}
                  />
                )}
                <span
                  className={`text-sm font-semibold font-ui mb-0.5 ${selected ? meta.accent : "text-black dark:text-white"}`}
                >
                  {meta.label}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50 font-body leading-tight">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model selector */}
      <div className="mb-5">
        <label className="block text-sm font-ui font-medium text-black dark:text-white mb-2">
          Model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green font-body"
        >
          {MODELS[provider].map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* API key input */}
      <div className="mb-5">
        <label className="block text-sm font-ui font-medium text-black dark:text-white mb-2">
          API Key
        </label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40" />
          <Input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestState("idle");
              setTestError("");
            }}
            placeholder={
              isActive
                ? "Enter new key to replace existing"
                : "Paste your API key here"
            }
            className="pl-9 pr-10 bg-white dark:bg-neutral-800 border-black/20 dark:border-white/20 text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 font-body text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            {showKey ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Test connection */}
      <div className="mb-5">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={!apiKey.trim() || testState === "testing"}
          className="border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
        >
          {testState === "testing" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : testState === "ok" ? (
            <CheckCircle2 className="w-4 h-4 mr-2 text-dark-green dark:text-light-green" />
          ) : testState === "fail" ? (
            <AlertCircle className="w-4 h-4 mr-2 text-red-500" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          {testState === "testing" ? "Testing..." : "Test Connection"}
        </Button>

        {testState === "ok" && (
          <p className="mt-2 text-sm text-dark-green dark:text-light-green font-body">
            Connection successful — key is valid.
          </p>
        )}
        {testState === "fail" && (
          <p className="mt-2 text-sm text-red-500 font-body">
            {testError || "Connection failed. Check your key and try again."}
          </p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={testState !== "ok" || saveState === "saving"}
          className="bg-dark-green dark:bg-light-green text-white hover:bg-light-green dark:hover:bg-dark-green transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveState === "saving" && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {saveState === "saving" ? "Saving..." : "Save Provider"}
        </Button>

        {saveState === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-dark-green dark:text-light-green font-body">
            <CheckCircle2 className="w-4 h-4" />
            Saved — BYOK active
          </span>
        )}
        {saveState === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-500 font-body">
            <AlertCircle className="w-4 h-4" />
            Save failed. Try again.
          </span>
        )}
      </div>

      {/* Remove */}
      {isActive && (
        <div className="mt-6 pt-5 border-t border-black/10 dark:border-white/10">
          <p className="text-xs text-black/50 dark:text-white/50 font-body mb-3">
            You&apos;ll return to TTT AI ({PLATFORM_AI_DAILY_LIMIT}{" "}
            requests/day, resets at midnight UTC).
          </p>
          <Button
            variant="outline"
            onClick={handleRemove}
            disabled={removeState === "removing"}
            className="border-red-500/30 text-red-500 hover:bg-red-500/5 bg-transparent disabled:opacity-40"
          >
            {removeState === "removing" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {removeState === "removing"
              ? "Removing..."
              : "Remove Custom Provider"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AiSettings;
