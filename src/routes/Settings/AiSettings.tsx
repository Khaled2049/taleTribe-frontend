import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/contexts/AuthContext";
import { firestore } from "@novelsync/platform-auth";
import {
  deleteAiSettings,
  getAiProviderCatalog,
  getAiSettings,
  saveAiSettings,
  type AiProvider,
  type AiProviderCatalog,
  type AiSettingsSummary,
} from "@/cloudFunctions/aiSettings";
import {
  PLATFORM_AI_DAILY_LIMIT,
  getPlatformAiRemaining,
  getTodayPlatformAiUsage,
} from "@/config/aiQuota";
import { MODELS, PROVIDERS, type ProviderKey } from "@/config/aiProviders";
import {
  FIELD_LABEL,
  Segmented,
  SettingsPanel,
  StatusDot,
} from "@/routes/Profile/SettingsPanel";

interface QuotaSnapshot {
  aiUsage: number;
  lastAiUsageDate: string;
}

const FALLBACK_CATALOG: AiProviderCatalog = {
  version: 1,
  providers: (Object.keys(PROVIDERS) as ProviderKey[]).map((id) => ({
    id,
    ...PROVIDERS[id],
    default_model: MODELS[id][0].value,
    models: MODELS[id].map((model) => ({
      id: model.value,
      label: model.label,
      description: "",
      tier: "standard",
      capabilities: ["text"],
    })),
  })),
};

const EMPTY_SETTINGS: AiSettingsSummary = {
  active: false,
  provider: null,
  model: null,
  keyHint: null,
  validatedAt: null,
};

const AiSettings = () => {
  const { user } = useAuthContext();
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [settings, setSettings] = useState<AiSettingsSummary>(EMPTY_SETTINGS);
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [removeState, setRemoveState] = useState<"idle" | "removing">("idle");
  const [message, setMessage] = useState("");
  const [quotaSnapshot, setQuotaSnapshot] = useState<QuotaSnapshot | null>(
    null,
  );

  const providerEntry = useMemo(
    () =>
      catalog.providers.find((item) => item.id === provider) ??
      catalog.providers[0],
    [catalog, provider],
  );
  const effectiveAiUsage = quotaSnapshot?.aiUsage ?? user?.aiUsage;
  const effectiveLastAiUsageDate =
    quotaSnapshot?.lastAiUsageDate ?? user?.lastAiUsageDate;
  const usedToday = getTodayPlatformAiUsage(
    effectiveAiUsage,
    effectiveLastAiUsageDate,
  );
  const requestsRemaining = getPlatformAiRemaining(
    effectiveAiUsage,
    effectiveLastAiUsageDate,
  );
  const usagePercent =
    PLATFORM_AI_DAILY_LIMIT > 0
      ? Math.min(100, Math.round((usedToday / PLATFORM_AI_DAILY_LIMIT) * 100))
      : 0;
  const remainingPercent = 100 - usagePercent;
  const hasSavedKeyForProvider =
    settings.active && settings.provider === provider;
  const automaticModel = providerEntry?.models.find(
    (item) => item.id === providerEntry.default_model,
  );
  const connectedProvider = catalog.providers.find(
    (item) => item.id === settings.provider,
  );
  const isBusy = saveState === "saving" || removeState === "removing";
  const validatedAt = settings.validatedAt
    ? new Date(settings.validatedAt)
    : null;
  const validatedDate =
    validatedAt && !Number.isNaN(validatedAt.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(validatedAt)
      : null;

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getAiProviderCatalog(), getAiSettings()]).then(
      (results) => {
        if (!mounted) return;
        const [catalogResult, settingsResult] = results;
        const nextCatalog =
          catalogResult.status === "fulfilled"
            ? catalogResult.value
            : FALLBACK_CATALOG;
        const nextSettings =
          settingsResult.status === "fulfilled"
            ? settingsResult.value
            : EMPTY_SETTINGS;
        setCatalog(nextCatalog);
        setSettings(nextSettings);
        const nextProvider =
          nextSettings.provider ?? nextCatalog.providers[0]?.id ?? "gemini";
        setProvider(nextProvider);
        setModel(nextSettings.model ?? "");
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;
    getDoc(doc(firestore, "users", user.uid))
      .then((snapshot) => {
        if (!mounted || !snapshot.exists()) return;
        const data = snapshot.data();
        setQuotaSnapshot({
          aiUsage: typeof data.aiUsage === "number" ? data.aiUsage : 0,
          lastAiUsageDate:
            typeof data.lastAiUsageDate === "string"
              ? data.lastAiUsageDate
              : "",
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const selectProvider = (nextProvider: AiProvider) => {
    setProvider(nextProvider);
    setModel("");
    setApiKey("");
    setSaveState("idle");
    setMessage("");
  };

  const handleSave = async () => {
    if (!apiKey.trim() && !hasSavedKeyForProvider) {
      setSaveState("error");
      setMessage("Enter an API key for this provider.");
      return;
    }
    setSaveState("saving");
    setMessage("");
    try {
      await saveAiSettings({
        provider,
        apiKey: apiKey.trim() || undefined,
        model: model || null,
      });
      const next: AiSettingsSummary = {
        active: true,
        provider,
        model: model || null,
        keyHint: apiKey.trim() ? apiKey.trim().slice(-4) : settings.keyHint,
        validatedAt: new Date().toISOString(),
      };
      setSettings(next);
      setApiKey("");
      setSaveState("saved");
      setMessage("Verified and saved.");
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save this provider.",
      );
    }
  };

  const handleRemove = async () => {
    setRemoveState("removing");
    setMessage("");
    try {
      await deleteAiSettings();
      setSettings(EMPTY_SETTINGS);
      setApiKey("");
      setSaveState("idle");
      setMessage("Disconnected. Using TTT AI.");
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not disconnect provider.",
      );
    } finally {
      setRemoveState("idle");
    }
  };

  return (
    <SettingsPanel
      title="Provider"
      meta={
        <StatusDot tone={loading ? "idle" : "ok"}>
          {loading
            ? "Checking"
            : settings.active
              ? `Your ${connectedProvider?.label ?? "key"}`
              : "TTT AI"}
        </StatusDot>
      }
    >
      <Segmented
        label="AI provider"
        value={provider}
        options={catalog.providers.map((item) => ({
          value: item.id,
          label: item.label,
        }))}
        onChange={selectProvider}
        disabled={loading || isBusy}
      />

      <div className="mt-6 space-y-5">
        <label className="block" htmlFor="ai-provider-model">
          <span className={FIELD_LABEL}>Model</span>
          <div className="relative">
            <select
              id="ai-provider-model"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setSaveState("idle");
                setMessage("");
              }}
              disabled={loading || isBusy}
              className="h-10 w-full appearance-none border-0 border-b border-ns-border bg-transparent px-0 pr-8 font-ui text-sm text-ns-ink outline-none transition-colors focus:border-ns-accent focus:ring-0 disabled:cursor-wait disabled:opacity-50 dark:[color-scheme:dark]"
            >
              <option value="">
                Automatic ·{" "}
                {automaticModel?.label ?? providerEntry?.default_model}
              </option>
              {providerEntry?.models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-ink-muted" />
          </div>
        </label>

        <label className="block" htmlFor="ai-provider-key">
          <span className={FIELD_LABEL}>API key</span>
          <div className="relative border-b border-ns-border transition-colors focus-within:border-ns-accent">
            <Input
              id="ai-provider-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setSaveState("idle");
                setMessage("");
              }}
              placeholder={
                hasSavedKeyForProvider
                  ? `Saved ••••${settings.keyHint ?? ""}`
                  : `Paste ${providerEntry?.label ?? "provider"} key`
              }
              className="h-10 rounded-none border-0 bg-transparent px-0 pr-9 font-mono text-[13px] shadow-none focus-visible:border-0 focus-visible:ring-0"
              autoComplete="off"
              disabled={isBusy}
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-8 items-center justify-end text-ns-ink-muted transition-colors hover:text-ns-ink"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </label>
      </div>

      <div className="mt-6">
        {settings.active ? (
          <p className="font-ui text-xs text-ns-ink-secondary">
            {connectedProvider?.label ?? settings.provider} ·{" "}
            {settings.model ?? "Automatic"} ·{" "}
            <span className="font-mono">••••{settings.keyHint ?? ""}</span>
            {validatedDate && (
              <span className="text-ns-ink-muted">
                {" "}
                · verified {validatedDate}
              </span>
            )}
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-4 font-ui text-xs">
              <span className="text-ns-ink-secondary">
                <span className="font-semibold tabular-nums text-ns-ink">
                  {requestsRemaining}
                </span>
                /{PLATFORM_AI_DAILY_LIMIT} requests left today
              </span>
              <span className="text-ns-ink-muted">Resets 00:00 UTC</span>
            </div>
            <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-ns-border">
              <div
                className="h-full rounded-full bg-ns-accent transition-[width] duration-500"
                style={{ width: `${remainingPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-start gap-2 font-ui text-xs ${saveState === "error" ? "text-ns-destructive" : "text-ns-success"}`}
        >
          {saveState === "error" ? (
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 font-ui text-[11px] text-ns-ink-muted">
          <LockKeyhole className="h-3 w-3" />
          Encrypted at rest
        </span>
        <div className="flex items-center gap-1">
          {settings.active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isBusy}
              className="text-ns-ink-muted hover:bg-transparent hover:text-ns-destructive"
            >
              {removeState === "removing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isBusy || loading}
            className="gap-2 px-4"
          >
            {saveState === "saving" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {saveState === "saving" ? "Testing…" : "Test & save"}
          </Button>
        </div>
      </div>
    </SettingsPanel>
  );
};

export default AiSettings;
