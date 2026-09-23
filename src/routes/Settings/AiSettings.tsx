import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Zap,
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
  AI_SETTINGS_COPY,
  PLATFORM_AI_DAILY_LIMIT,
  getPlatformAiRemaining,
  getTodayPlatformAiUsage,
} from "@/config/aiQuota";
import { MODELS, PROVIDERS, type ProviderKey } from "@/config/aiProviders";

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
  const selectedModel = providerEntry?.models.find((item) => item.id === model);
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
    const canReuseSavedKey = settings.active && settings.provider === provider;
    if (!apiKey.trim() && !canReuseSavedKey) {
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
      setMessage("Connection verified and saved.");
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
      setMessage("Switched back to TheTaleTribe AI.");
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
    <section className="grid gap-7 border-b border-ns-border py-9 lg:grid-cols-[minmax(11rem,0.34fr)_minmax(0,1fr)] lg:gap-14 lg:py-11">
      <header>
        <div className="flex items-center gap-2 font-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-ns-accent">
          <Bot className="h-3.5 w-3.5" />
          Intelligence
        </div>
        <h2 className="mt-3 font-heading text-[1.85rem] font-medium leading-none text-ns-ink">
          AI provider
        </h2>
        <p className="mt-3 max-w-xs font-body text-sm leading-relaxed text-ns-ink-secondary">
          Choose the model that helps shape your stories. Use the house account
          or connect your own key.
        </p>
        <div className="mt-4 flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ns-ink-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${settings.active ? "bg-ns-success" : "bg-ns-accent"}`}
          />
          {loading
            ? "Checking status"
            : settings.active
              ? "Own key connected"
              : "Platform AI"}
        </div>
      </header>

      <div className="min-w-0">
        <div
          className="flex gap-6 overflow-x-auto border-b border-ns-border"
          role="radiogroup"
          aria-label="AI provider"
        >
          {catalog.providers.map((item) => {
            const active = item.id === provider;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={loading || isBusy}
                onClick={() => selectProvider(item.id)}
                className={`group relative flex shrink-0 items-center gap-2.5 pb-3 font-ui text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 ${active ? "text-ns-ink" : "text-ns-ink-muted hover:text-ns-ink"}`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-heading text-sm transition-colors ${active ? "bg-ns-accent text-white" : "bg-ns-surface text-ns-ink-secondary group-hover:bg-ns-surface-hover"}`}
                >
                  {active ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    item.label.charAt(0)
                  )}
                </span>
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ns-accent" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <p className="font-body text-[15px] text-ns-ink-secondary">
            {providerEntry?.description}
          </p>
          <span className="shrink-0 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-ns-ink-muted">
            {providerEntry?.models.length ?? 0} models available
          </span>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="block" htmlFor="ai-provider-model">
            <span className="mb-2 block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
              Model
            </span>
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
                className="h-11 w-full appearance-none border-0 border-b border-ns-border bg-transparent px-0 pr-8 font-ui text-sm text-ns-ink outline-none transition-colors focus:border-ns-accent focus:ring-0 disabled:cursor-wait disabled:opacity-50 dark:[color-scheme:dark]"
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
            <span className="mt-2 block min-h-5 font-body text-xs leading-relaxed text-ns-ink-muted">
              {selectedModel?.description ||
                `${automaticModel?.label ?? "The provider default"} will be selected automatically.`}
            </span>
          </label>

          <label className="block" htmlFor="ai-provider-key">
            <span className="mb-2 block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
              API key
            </span>
            <div className="relative border-b border-ns-border focus-within:border-ns-accent">
              <KeyRound className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-ink-muted" />
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
                  settings.active && settings.provider === provider
                    ? `Saved key ••••${settings.keyHint ?? ""}`
                    : `Paste your ${providerEntry?.label ?? "provider"} key`
                }
                className="h-11 rounded-none border-0 bg-transparent pl-7 pr-10 font-mono text-[13px] shadow-none focus-visible:border-0 focus-visible:ring-0"
                autoComplete="off"
                disabled={isBusy}
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-end text-ns-ink-muted transition-colors hover:text-ns-ink"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <span className="mt-2 block min-h-5 font-body text-xs leading-relaxed text-ns-ink-muted">
              {settings.active && settings.provider === provider
                ? "Leave blank to keep your saved key while changing models."
                : "Encrypted before storage and never shown again."}
            </span>
          </label>
        </div>

        <div className="mt-6 border-y border-ns-border py-4">
          {settings.active ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <span className="font-ui text-[9px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                  Routing
                </span>
                <p className="mt-1 font-ui text-sm font-semibold text-ns-success">
                  Direct
                </p>
              </div>
              <div>
                <span className="font-ui text-[9px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                  Provider
                </span>
                <p className="mt-1 font-ui text-sm text-ns-ink">
                  {connectedProvider?.label ?? settings.provider}
                </p>
              </div>
              <div>
                <span className="font-ui text-[9px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                  Model
                </span>
                <p className="mt-1 truncate font-ui text-sm text-ns-ink">
                  {settings.model ?? "Automatic"}
                </p>
              </div>
              <div>
                <span className="font-ui text-[9px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                  Key
                </span>
                <p className="mt-1 font-mono text-sm text-ns-ink">
                  •••• {settings.keyHint ?? "saved"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-ns-accent">
                  <Zap className="h-4 w-4" />
                  <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Included allowance
                  </span>
                </div>
                <p className="mt-2 font-heading text-3xl leading-none text-ns-ink">
                  {requestsRemaining}
                  <span className="ml-1.5 font-body text-sm text-ns-ink-muted">
                    of {PLATFORM_AI_DAILY_LIMIT} requests left
                  </span>
                </p>
              </div>
              <div className="w-full sm:max-w-56">
                <div className="h-1 overflow-hidden rounded-full bg-ns-border">
                  <div
                    className="h-full rounded-full bg-ns-accent transition-[width] duration-500"
                    style={{ width: `${remainingPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-right font-ui text-[10px] uppercase tracking-[0.1em] text-ns-ink-muted">
                  Resets midnight UTC
                </p>
              </div>
            </div>
          )}
        </div>

        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 flex items-start gap-2 font-ui text-sm ${saveState === "error" ? "text-ns-destructive" : "text-ns-success"}`}
          >
            {saveState === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-sm items-start gap-2 font-body text-xs leading-relaxed text-ns-ink-muted">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ns-accent" />
            Keys are encrypted at rest and sent only to the selected provider.{" "}
            {settings.active
              ? AI_SETTINGS_COPY.byokNoLimitHint
              : AI_SETTINGS_COPY.platformResetHint}
            {validatedDate ? ` Last verified ${validatedDate}.` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {settings.active && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                disabled={isBusy}
                className="gap-2 text-ns-destructive hover:bg-transparent hover:text-ns-destructive-hover"
              >
                {removeState === "removing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isBusy || loading}
              className="gap-2 px-5"
            >
              {saveState === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {saveState === "saving" ? "Testing connection…" : "Test & save"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AiSettings;
