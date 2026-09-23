import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
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
      setMessage(error instanceof Error ? error.message : "Could not disconnect provider.");
    } finally {
      setRemoveState("idle");
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="border-b border-black/10 px-6 py-5 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-green/10 dark:bg-light-green/10">
              <Bot className="h-5 w-5 text-dark-green dark:text-light-green" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold">AI Provider</h2>
              <p className="mt-1 max-w-2xl font-body text-sm text-black/60 dark:text-white/60">
                Use your included credits, or connect your own provider and choose the model that fits your writing.
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${settings.active ? "bg-dark-green/10 text-dark-green dark:bg-light-green/10 dark:text-light-green" : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"}`}>
            {settings.active ? "Own key active" : "Platform AI"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 font-ui text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Provider</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {catalog.providers.map((item) => {
                const active = item.id === provider;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProvider(item.id)}
                    className={`rounded-lg border p-3 text-left transition ${active ? "border-dark-green bg-dark-green/5 ring-1 ring-dark-green/20 dark:border-light-green dark:bg-light-green/5" : "border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25"}`}
                  >
                    <span className="block font-ui text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block font-body text-xs leading-relaxed text-black/55 dark:text-white/55">{item.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-ui text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Model</span>
              <select
                value={model}
                onChange={(event) => { setModel(event.target.value); setSaveState("idle"); setMessage(""); }}
                disabled={loading}
                className="h-10 w-full rounded-md border border-black/15 bg-white px-3 font-body text-sm outline-none focus:border-dark-green dark:border-white/15 dark:bg-black"
              >
                <option value="">Automatic ({providerEntry?.models.find((item) => item.id === providerEntry.default_model)?.label ?? providerEntry?.default_model})</option>
                {providerEntry?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              {selectedModel?.description && <span className="mt-1.5 block text-xs text-black/50 dark:text-white/50">{selectedModel.description}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block font-ui text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">API key</span>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => { setApiKey(event.target.value); setSaveState("idle"); setMessage(""); }}
                  placeholder={settings.active && settings.provider === provider ? `Saved key ••••${settings.keyHint ?? ""}` : `Paste your ${providerEntry?.label ?? "provider"} key`}
                  className="pr-10 font-mono"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowKey((value) => !value)} className="absolute inset-y-0 right-0 px-3 text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white" aria-label={showKey ? "Hide API key" : "Show API key"}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {settings.active && settings.provider === provider && <span className="mt-1.5 block text-xs text-black/50 dark:text-white/50">Leave blank to keep the saved key while changing models.</span>}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
            <Button onClick={handleSave} disabled={saveState === "saving" || loading} className="gap-2">
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saveState === "saving" ? "Testing connection…" : "Test & save"}
            </Button>
            {settings.active && (
              <Button variant="ghost" onClick={handleRemove} disabled={removeState === "removing"} className="gap-2 text-red-600 hover:text-red-700">
                {removeState === "removing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Disconnect
              </Button>
            )}
            {message && (
              <span className={`flex items-center gap-1.5 text-sm ${saveState === "error" ? "text-red-600" : "text-dark-green dark:text-light-green"}`}>
                {saveState === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {message}
              </span>
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-black/10 bg-neutral-50 p-4 dark:border-white/10 dark:bg-black/25">
          {settings.active ? (
            <>
              <KeyRound className="h-5 w-5 text-dark-green dark:text-light-green" />
              <p className="mt-3 font-ui text-sm font-semibold">Connected securely</p>
              <p className="mt-1 font-body text-xs leading-relaxed text-black/60 dark:text-white/60">
                {catalog.providers.find((item) => item.id === settings.provider)?.label} · {settings.model ?? "Automatic model"}<br />Key ending in ••••{settings.keyHint}
              </p>
              <p className="mt-3 font-body text-xs leading-relaxed text-black/50 dark:text-white/50">{AI_SETTINGS_COPY.byokNoLimitHint}</p>
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 text-dark-green dark:text-light-green" />
              <p className="mt-3 font-ui text-sm font-semibold">Included AI credits</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div className="h-full rounded-full bg-dark-green dark:bg-light-green" style={{ width: `${usagePercent}%` }} />
              </div>
              <p className="mt-2 font-body text-xs text-black/60 dark:text-white/60">{requestsRemaining} of {PLATFORM_AI_DAILY_LIMIT} requests remaining today</p>
            </>
          )}
          <p className="mt-4 border-t border-black/10 pt-3 font-body text-[11px] leading-relaxed text-black/45 dark:border-white/10 dark:text-white/45">
            Keys are encrypted at rest and sent only to the selected provider for your requests.
          </p>
        </aside>
      </div>
    </section>
  );
};

export default AiSettings;
