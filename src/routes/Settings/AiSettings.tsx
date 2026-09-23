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
  Sparkles,
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [removeState, setRemoveState] = useState<"idle" | "removing">("idle");
  const [message, setMessage] = useState("");
  const [quotaSnapshot, setQuotaSnapshot] = useState<QuotaSnapshot | null>(null);

  const providerEntry = useMemo(
    () => catalog.providers.find((item) => item.id === provider) ?? catalog.providers[0],
    [catalog, provider],
  );
  const selectedModel = providerEntry?.models.find((item) => item.id === model);
  const effectiveAiUsage = quotaSnapshot?.aiUsage ?? user?.aiUsage;
  const effectiveLastAiUsageDate = quotaSnapshot?.lastAiUsageDate ?? user?.lastAiUsageDate;
  const usedToday = getTodayPlatformAiUsage(effectiveAiUsage, effectiveLastAiUsageDate);
  const requestsRemaining = getPlatformAiRemaining(effectiveAiUsage, effectiveLastAiUsageDate);
  const usagePercent = PLATFORM_AI_DAILY_LIMIT > 0
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
  const validatedAt = settings.validatedAt ? new Date(settings.validatedAt) : null;
  const validatedDate = validatedAt && !Number.isNaN(validatedAt.getTime())
    ? new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(validatedAt)
    : null;

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getAiProviderCatalog(), getAiSettings()]).then((results) => {
      if (!mounted) return;
      const [catalogResult, settingsResult] = results;
      const nextCatalog = catalogResult.status === "fulfilled" ? catalogResult.value : FALLBACK_CATALOG;
      const nextSettings = settingsResult.status === "fulfilled" ? settingsResult.value : EMPTY_SETTINGS;
      setCatalog(nextCatalog);
      setSettings(nextSettings);
      const nextProvider = nextSettings.provider ?? nextCatalog.providers[0]?.id ?? "gemini";
      setProvider(nextProvider);
      setModel(nextSettings.model ?? "");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;
    getDoc(doc(firestore, "users", user.uid)).then((snapshot) => {
      if (!mounted || !snapshot.exists()) return;
      const data = snapshot.data();
      setQuotaSnapshot({
        aiUsage: typeof data.aiUsage === "number" ? data.aiUsage : 0,
        lastAiUsageDate: typeof data.lastAiUsageDate === "string" ? data.lastAiUsageDate : "",
      });
    }).catch(() => undefined);
    return () => { mounted = false; };
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
      await saveAiSettings({ provider, apiKey: apiKey.trim() || undefined, model: model || null });
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
      setMessage(error instanceof Error ? error.message : "Could not save this provider.");
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
      setMessage(error instanceof Error ? error.message : "Could not disconnect provider.");
    } finally {
      setRemoveState("idle");
    }
  };

  return (
    <section className="relative mb-6 overflow-hidden rounded-ns-2xl border border-ns-border bg-ns-elevated shadow-ns-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-36 h-80 w-80 rounded-full bg-ns-accent-subtle blur-3xl"
      />

      <header className="relative flex flex-col gap-5 border-b border-ns-border px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div className="flex items-start gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-ns-xl border border-ns-accent/20 bg-ns-accent-subtle text-ns-accent shadow-ns-sm">
            <Bot className="h-5 w-5" strokeWidth={1.8} />
            <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-ns-ink-muted">
              Your writing engine
            </p>
            <h2 className="mt-1 font-heading text-[2rem] font-medium leading-none text-ns-ink">
              AI Provider
            </h2>
            <p className="mt-2 max-w-[62ch] font-body text-[15px] leading-relaxed text-ns-ink-secondary">
              Write with your included allowance, or bring your own key for direct access to the model you prefer.
            </p>
          </div>
        </div>

        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] ${settings.active ? "border-ns-success/25 bg-ns-success/10 text-ns-success" : "border-ns-border bg-ns-surface text-ns-ink-secondary"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${settings.active ? "bg-ns-success" : "bg-ns-ink-muted"}`} />
          {loading ? "Checking status" : settings.active ? "Own key connected" : "Platform AI"}
        </div>
      </header>

      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ns-ink font-ui text-[10px] font-semibold text-ns-bg">1</span>
            <div>
              <h3 className="font-ui text-sm font-semibold text-ns-ink">Choose a provider</h3>
              <p className="mt-0.5 font-body text-sm text-ns-ink-muted">Your key is only sent to the provider selected here.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="AI provider">
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
                  className={`group relative min-h-32 overflow-hidden rounded-ns-xl border p-4 text-left transition-all duration-200 ease-ns-spring disabled:cursor-wait disabled:opacity-60 ${active ? "border-ns-accent bg-ns-accent-subtle shadow-[inset_0_0_0_1px_var(--ns-accent)]" : "border-ns-border bg-ns-elevated hover:-translate-y-0.5 hover:border-ns-border-strong hover:bg-ns-surface hover:shadow-ns-sm"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border font-heading text-lg font-semibold transition-colors ${active ? "border-ns-accent bg-ns-accent text-white" : "border-ns-border bg-ns-surface text-ns-ink-secondary group-hover:border-ns-border-strong"}`}>
                    {active ? <Check className="h-4 w-4" strokeWidth={2.5} /> : item.label.charAt(0)}
                  </span>
                  <span className="mt-3 block font-ui text-[15px] font-semibold text-ns-ink">{item.label}</span>
                  <span className="mt-1 block font-body text-[13px] leading-snug text-ns-ink-secondary">{item.description}</span>
                  <span className="mt-3 block font-ui text-[10px] font-medium uppercase tracking-[0.12em] text-ns-ink-muted">
                    {item.models.length} {item.models.length === 1 ? "model" : "models"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 border-t border-ns-border pt-6">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ns-ink font-ui text-[10px] font-semibold text-ns-bg">2</span>
              <div>
                <h3 className="font-ui text-sm font-semibold text-ns-ink">Configure your connection</h3>
                <p className="mt-0.5 font-body text-sm text-ns-ink-muted">Automatic is a good default; you can change models anytime.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block" htmlFor="ai-provider-model">
                <span className="mb-2 block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">Model</span>
                <div className="relative">
                  <select
                    id="ai-provider-model"
                    value={model}
                    onChange={(event) => { setModel(event.target.value); setSaveState("idle"); setMessage(""); }}
                    disabled={loading || isBusy}
                    className="h-11 w-full appearance-none rounded-ns-lg border border-ns-border bg-ns-elevated px-3.5 pr-10 font-ui text-sm text-ns-ink shadow-ns-sm outline-none transition-all focus:border-ns-accent focus:ring-2 focus:ring-[var(--ns-ring)] disabled:cursor-wait disabled:opacity-60 dark:[color-scheme:dark]"
                  >
                    <option value="">Automatic · {automaticModel?.label ?? providerEntry?.default_model}</option>
                    {providerEntry?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-ink-muted" />
                </div>
                <span className="mt-2 block min-h-5 font-body text-xs leading-relaxed text-ns-ink-muted">
                  {selectedModel?.description || `${automaticModel?.label ?? "The provider default"} will be selected automatically.`}
                </span>
              </label>

              <label className="block" htmlFor="ai-provider-key">
                <span className="mb-2 block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">API key</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-ink-muted" />
                  <Input
                    id="ai-provider-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => { setApiKey(event.target.value); setSaveState("idle"); setMessage(""); }}
                    placeholder={settings.active && settings.provider === provider ? `Saved key ••••${settings.keyHint ?? ""}` : `Paste your ${providerEntry?.label ?? "provider"} key`}
                    className="h-11 rounded-ns-lg pl-10 pr-11 font-mono text-[13px]"
                    autoComplete="off"
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ns-ink-muted transition-colors hover:text-ns-ink"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <span className="mt-2 block min-h-5 font-body text-xs leading-relaxed text-ns-ink-muted">
                  {settings.active && settings.provider === provider
                    ? "Leave blank to keep your saved key while changing models."
                    : "Your key is encrypted before it is stored."}
                </span>
              </label>
            </div>
          </div>

          {message && (
            <div
              role="status"
              aria-live="polite"
              className={`mt-5 flex items-start gap-2.5 rounded-ns-lg border px-3.5 py-3 font-ui text-sm ${saveState === "error" ? "border-ns-destructive/25 bg-ns-destructive/5 text-ns-destructive" : "border-ns-success/25 bg-ns-success/10 text-ns-success"}`}
            >
              {saveState === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{message}</span>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-ns-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 font-body text-xs text-ns-ink-muted">
              <LockKeyhole className="h-3.5 w-3.5" />
              Credentials never count against platform credits.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {settings.active && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={isBusy}
                  className="gap-2 text-ns-destructive hover:bg-ns-destructive/5 hover:text-ns-destructive-hover"
                >
                  {removeState === "removing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Disconnect
                </Button>
              )}
              <Button onClick={handleSave} disabled={isBusy || loading} size="lg" className="gap-2 px-6 shadow-ns">
                {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {saveState === "saving" ? "Testing connection…" : "Test & save"}
              </Button>
            </div>
          </div>
        </div>

        <aside className="border-t border-ns-border bg-ns-surface/70 p-5 sm:p-7 lg:border-l lg:border-t-0">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-ns-ink-muted">Current routing</p>
          {settings.active ? (
            <div className="mt-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-ns-success/25 bg-ns-success/10 text-ns-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-2xl font-medium text-ns-ink">Connected securely</h3>
              <p className="mt-1 font-body text-sm leading-relaxed text-ns-ink-secondary">Requests go directly to your selected provider without using platform credits.</p>

              <dl className="mt-5 divide-y divide-ns-border rounded-ns-xl border border-ns-border bg-ns-elevated px-4 shadow-ns-sm">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="font-ui text-xs text-ns-ink-muted">Provider</dt>
                  <dd className="font-ui text-xs font-semibold text-ns-ink">{connectedProvider?.label ?? settings.provider}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="font-ui text-xs text-ns-ink-muted">Model</dt>
                  <dd className="max-w-36 truncate text-right font-ui text-xs font-semibold text-ns-ink">{settings.model ?? "Automatic"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="font-ui text-xs text-ns-ink-muted">Key</dt>
                  <dd className="font-mono text-xs font-semibold text-ns-ink">•••• {settings.keyHint ?? "saved"}</dd>
                </div>
              </dl>

              {validatedDate && <p className="mt-3 text-center font-ui text-[10px] uppercase tracking-[0.1em] text-ns-ink-muted">Verified {validatedDate}</p>}
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-center gap-4">
                <div
                  className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(var(--ns-accent) ${remainingPercent}%, var(--ns-border) 0)` }}
                >
                  <div className="absolute inset-[5px] rounded-full bg-ns-elevated" />
                  <div className="relative text-center">
                    <span className="block font-heading text-2xl font-semibold leading-none text-ns-ink">{requestsRemaining}</span>
                    <span className="mt-1 block font-ui text-[8px] font-semibold uppercase tracking-wider text-ns-ink-muted">left</span>
                  </div>
                </div>
                <div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ns-accent-subtle text-ns-accent">
                    <Zap className="h-4 w-4" />
                  </span>
                  <h3 className="mt-2 font-ui text-sm font-semibold text-ns-ink">Included allowance</h3>
                </div>
              </div>
              <p className="mt-4 font-body text-sm leading-relaxed text-ns-ink-secondary">
                {requestsRemaining} of {PLATFORM_AI_DAILY_LIMIT} requests remain today. Your allowance resets at midnight UTC.
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ns-border">
                <div className="h-full rounded-full bg-ns-accent transition-[width] duration-500" style={{ width: `${remainingPercent}%` }} />
              </div>
            </div>
          )}

          <div className="mt-6 rounded-ns-xl border border-ns-border bg-ns-elevated p-4">
            <div className="flex items-center gap-2 text-ns-ink">
              <LockKeyhole className="h-4 w-4 text-ns-accent" />
              <p className="font-ui text-xs font-semibold">Private by design</p>
            </div>
            <p className="mt-2 font-body text-xs leading-relaxed text-ns-ink-muted">
              Keys are encrypted at rest and sent only to the selected provider for your requests.
            </p>
          </div>

          {!settings.active && <p className="mt-4 font-body text-xs leading-relaxed text-ns-ink-muted">{AI_SETTINGS_COPY.platformResetHint}</p>}
          {settings.active && <p className="mt-4 font-body text-xs leading-relaxed text-ns-ink-muted">{AI_SETTINGS_COPY.byokNoLimitHint}</p>}
        </aside>
      </div>
    </section>
  );
};

export default AiSettings;
