import React, { useState, useEffect, lazy, Suspense } from "react";

const AiSettings = lazy(() => import("@/routes/Settings/AiSettings"));
import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserWalletAddress } from "@/hooks/useUserWalletAddress";
import { useEarnings } from "@/hooks/useEarnings";
import { useUserStoriesWithEarnings } from "@/hooks/queries/useStoryQueries";
import { useMcpAccess } from "@/hooks/useMcpAccess";
import {
  useAiCreditsQuery,
  usePurchaseCredits,
} from "@/hooks/queries/useCreditQueries";
import SidebarBalanceCard from "@/components/explore/SidebarBalanceCard";
import { useAccount, useChainId } from "wagmi";
import { profileRepo } from "@novelsync/story-data-client";
import { getApiErrorMessage } from "@/cloudFunctions";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/web3/WalletConnectButton";
import { WEB3_ENABLED } from "@/config/featureFlags";
import {
  Cable,
  CircleDollarSign,
  Coins,
  DollarSign,
  Loader2,
  Copy,
  CheckCircle2,
  Trash2,
  Sun,
  Moon,
  Palette,
  Percent,
  Settings2,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "31337");
const TARGET_CHAIN_NAME =
  TARGET_CHAIN_ID === 31337
    ? "Anvil"
    : TARGET_CHAIN_ID === 11155111
      ? "Sepolia"
      : TARGET_CHAIN_ID === 1
        ? "Ethereum"
        : `Chain ${TARGET_CHAIN_ID}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

const SettingsSection = ({
  kicker,
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: {
  kicker: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    className={`grid gap-7 border-b border-ns-border py-9 lg:grid-cols-[minmax(11rem,0.34fr)_minmax(0,1fr)] lg:gap-14 lg:py-11 ${className}`}
  >
    <header>
      <div className="flex items-center gap-2 font-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-ns-accent">
        <Icon className="h-3.5 w-3.5" />
        {kicker}
      </div>
      <h2 className="mt-3 font-heading text-[1.85rem] font-medium leading-none text-ns-ink">
        {title}
      </h2>
      <p className="mt-3 max-w-xs font-body text-sm leading-relaxed text-ns-ink-secondary">
        {description}
      </p>
    </header>
    <div className="min-w-0">{children}</div>
  </section>
);

// Preset top-up tiers (MVP: no payment). Must match ALLOWED_CREDIT_TIERS in the
// Firebase Function / agent service, which reject any other amount.
const CREDIT_TIERS = [10000, 50000, 100000];

const McpAccessCard: React.FC<{ userId: string | undefined }> = ({
  userId,
}) => {
  const { status, loading, requesting, error, request } = useMcpAccess(userId);

  const body = () => {
    if (loading) {
      return <Loader2 className="w-4 h-4 animate-spin text-ns-ink-muted" />;
    }
    if (status === "granted") {
      return (
        <span className="flex items-center gap-2 text-sm font-ui text-ns-accent">
          <CheckCircle2 className="w-4 h-4" /> Enabled
        </span>
      );
    }
    if (status === "requested") {
      return (
        <span className="text-sm font-ui text-ns-ink-muted">
          Pending review
        </span>
      );
    }
    return (
      <Button variant="outline" disabled={requesting} onClick={() => request()}>
        {requesting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Request access"
        )}
      </Button>
    );
  };

  const description =
    status === "granted"
      ? "Add TheTaleTribe's connector in Claude to read and draft your stories."
      : status === "revoked"
        ? "Access was turned off for this account. You can request it again and we'll take another look."
        : "MCP is in limited testing. Request access and we'll review it.";

  return (
    <SettingsSection
      kicker="Integrations"
      title="Claude connector"
      description="Give your writing tools a secure path to the stories in your library."
      icon={Cable}
    >
      <div className="flex flex-col gap-4 border-y border-ns-border py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-ui text-sm font-semibold text-ns-ink">
            MCP access
          </p>
          <p className="mt-1 max-w-xl font-body text-sm leading-relaxed text-ns-ink-muted">
            {description}
          </p>
        </div>
        <div className="shrink-0">{body()}</div>
      </div>
      {error && (
        <p className="pt-3 font-ui text-xs text-ns-destructive">{error}</p>
      )}
    </SettingsSection>
  );
};

const AiCreditsCard: React.FC<{ userId: string | undefined }> = ({
  userId,
}) => {
  const { data, isLoading, isError } = useAiCreditsQuery(userId);
  const purchase = usePurchaseCredits(userId);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  const handlePurchase = (amount: number) => {
    purchase.mutate(amount, {
      onSuccess: () => {
        setJustAdded(amount);
        setTimeout(() => setJustAdded(null), 3000);
      },
    });
  };

  return (
    <SettingsSection
      kicker="Usage"
      title="AI credits"
      description="Credits power platform AI features such as co-write when your own key is not connected."
      icon={Coins}
    >
      <div className="flex items-end justify-between gap-6 border-b border-ns-border pb-5">
        <div>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
            Available balance
          </p>
          <span className="mt-2 block font-heading text-4xl leading-none text-ns-ink tabular-nums">
            {isLoading
              ? "…"
              : isError
                ? "—"
                : (data?.availableCredits ?? 0).toLocaleString()}
          </span>
        </div>
        <span className="pb-1 font-ui text-xs text-ns-ink-muted">credits</span>
      </div>

      <div className="pt-5">
        <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
          Top up
        </p>
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {CREDIT_TIERS.map((amount) => {
            const pending = purchase.isPending && purchase.variables === amount;
            return (
              <Button
                key={amount}
                variant="outline"
                disabled={purchase.isPending}
                onClick={() => handlePurchase(amount)}
                className="rounded-full bg-transparent px-5 shadow-none"
              >
                {pending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `+${amount.toLocaleString()}`
                )}
              </Button>
            );
          })}
        </div>

        {justAdded !== null && (
          <div className="mt-3 flex items-center gap-2 text-sm font-ui text-ns-accent">
            <CheckCircle2 className="w-4 h-4" /> Added{" "}
            {justAdded.toLocaleString()} credits
          </div>
        )}
        {purchase.isError && (
          <p className="mt-3 text-sm font-ui text-ns-destructive">
            {getApiErrorMessage(purchase.error, "Failed to purchase credits")}
          </p>
        )}
        {isError && !purchase.isError && (
          <p className="mt-3 text-xs font-ui text-ns-ink-muted">
            Couldn&apos;t load your balance. Try refreshing.
          </p>
        )}
      </div>
    </SettingsSection>
  );
};

// ─── Owner-only settings (Appearance, AI Provider, Wallet & Earnings) ──────────

const OwnerSettings: React.FC = () => {
  const { user } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const { address } = useAccount();
  const chainId = useChainId();
  const {
    walletAddress: savedWalletAddress,
    setWalletAddress: setSavedWalletAddress,
  } = useUserWalletAddress(user?.uid);
  const { lifetimeEarnings, fetchLifetimeEarnings } = useEarnings();
  const { data: stories = [] } = useUserStoriesWithEarnings(user?.uid);

  // Live wallet state
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setConnectedAddress(address || null);
  }, [address]);

  useEffect(() => {
    if (savedWalletAddress) fetchLifetimeEarnings(savedWalletAddress);
  }, [savedWalletAddress, fetchLifetimeEarnings]);

  const handleCopyAddress = async () => {
    if (!connectedAddress) return;
    try {
      await navigator.clipboard.writeText(connectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const handleSaveWallet = async () => {
    if (!user?.uid || !connectedAddress) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setDeleteSuccess(false);
    try {
      await profileRepo.updateMe({ walletAddress: connectedAddress });
      setSavedWalletAddress(connectedAddress);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save wallet address.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWallet = async () => {
    if (!user?.uid || !savedWalletAddress) return;
    setIsDeleting(true);
    setSaveError(null);
    setSaveSuccess(false);
    setDeleteSuccess(false);
    try {
      await profileRepo.updateMe({ walletAddress: "" });
      setSavedWalletAddress(null);
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to remove wallet address.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isWalletConnected = !!connectedAddress;
  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;
  const addressSaved =
    savedWalletAddress &&
    connectedAddress?.toLowerCase() === savedWalletAddress.toLowerCase();

  const hasLifetimeEarnings =
    parseFloat(lifetimeEarnings.eth) > 0 ||
    parseFloat(lifetimeEarnings.usdc) > 0;

  const totalEthEarnings = stories.reduce(
    (sum, s) => sum + parseFloat(s.earnings.eth || "0"),
    0,
  );
  const totalUsdcEarnings = stories.reduce(
    (sum, s) => sum + parseFloat(s.earnings.usdc || "0"),
    0,
  );

  return (
    <section className="mt-10 border-t border-ns-border">
      <header className="relative overflow-hidden border-b border-ns-border py-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-ns-accent-subtle blur-3xl"
        />
        <div className="relative grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ns-accent text-white">
            <Settings2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-ns-accent">
              The writer&apos;s desk
            </p>
            <h1 className="mt-2 font-heading text-[2.7rem] font-light leading-none text-ns-ink sm:text-[3.25rem]">
              Studio settings
            </h1>
            <p className="mt-3 max-w-2xl font-body text-[16px] leading-relaxed text-ns-ink-secondary">
              Tune the atmosphere, intelligence, integrations, and payments
              behind your writing space.
            </p>
          </div>
        </div>
      </header>

      <SettingsSection
        kicker="Workspace"
        title="Appearance"
        description="Choose the atmosphere that feels best for long writing sessions. Both editions use a warm, low-glare palette."
        icon={Palette}
      >
        <div
          className="flex border-b border-ns-border"
          role="radiogroup"
          aria-label="Color theme"
        >
          <button
            type="button"
            role="radio"
            aria-checked={theme === "light"}
            onClick={() => {
              if (theme !== "light") toggleTheme();
            }}
            className={`relative flex flex-1 items-center gap-3 py-4 pr-4 text-left transition-colors sm:min-w-52 sm:flex-none ${theme === "light" ? "text-ns-ink" : "text-ns-ink-muted hover:text-ns-ink"}`}
          >
            <Sun className="h-4 w-4" />
            <span>
              <span className="block font-ui text-sm font-semibold">
                Daylight
              </span>
              <span className="mt-0.5 block font-body text-xs">
                Warm paper and dark ink
              </span>
            </span>
            {theme === "light" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ns-accent" />
            )}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "dark"}
            onClick={() => {
              if (theme !== "dark") toggleTheme();
            }}
            className={`relative flex flex-1 items-center gap-3 py-4 pl-4 text-left transition-colors sm:min-w-52 sm:flex-none ${theme === "dark" ? "text-ns-ink" : "text-ns-ink-muted hover:text-ns-ink"}`}
          >
            <Moon className="h-4 w-4" />
            <span>
              <span className="block font-ui text-sm font-semibold">
                Midnight
              </span>
              <span className="mt-0.5 block font-body text-xs">
                Soft charcoal and bright ink
              </span>
            </span>
            {theme === "dark" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ns-accent" />
            )}
          </button>
        </div>
      </SettingsSection>

      <Suspense
        fallback={
          <div className="grid gap-7 border-b border-ns-border py-11 lg:grid-cols-[minmax(11rem,0.34fr)_minmax(0,1fr)] lg:gap-14">
            <div className="h-24 animate-pulse bg-ns-surface" />
            <div className="h-40 animate-pulse bg-ns-surface" />
          </div>
        }
      >
        <AiSettings />
      </Suspense>

      {!user?.hasCustomAiProvider && <AiCreditsCard userId={user?.uid} />}

      <SettingsSection
        kicker="Community"
        title="$TALE balance"
        description="Your community token balance, used across TheTaleTribe experiences and rewards."
        icon={CircleDollarSign}
      >
        <SidebarBalanceCard bare />
      </SettingsSection>

      <McpAccessCard userId={user?.uid} />

      {WEB3_ENABLED && (
        <>
          <SettingsSection
            kicker="Payments"
            title="Wallet"
            description={`Connect on ${TARGET_CHAIN_NAME} to receive reader tips and publish a payout address to your profile.`}
            icon={Wallet}
          >
            {!isWalletConnected ? (
              <div className="flex flex-col gap-4 border-y border-ns-border py-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl font-body text-sm leading-relaxed text-ns-ink-secondary">
                  No wallet is connected. Connect one to set your public payout
                  address.
                </p>
                <WalletConnectButton />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 border-b border-ns-border pb-4">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isCorrectNetwork ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="font-ui text-sm text-ns-ink">
                    {isCorrectNetwork
                      ? `Connected · ${TARGET_CHAIN_NAME}`
                      : `Wrong network — please switch to ${TARGET_CHAIN_NAME}`}
                  </span>
                </div>

                <div className="py-5">
                  <p className="mb-2 font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                    Address
                  </p>
                  <div className="flex items-center gap-3 border-b border-ns-border pb-3">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-ns-ink">
                      {connectedAddress}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="p-1.5 text-ns-ink-muted transition-colors hover:text-ns-ink"
                      aria-label="Copy wallet address"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-ns-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {savedWalletAddress && (
                      <button
                        type="button"
                        onClick={handleDeleteWallet}
                        disabled={isDeleting}
                        className="p-1.5 text-ns-ink-muted transition-colors hover:text-ns-destructive disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Remove saved address"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!addressSaved && (
                    <Button onClick={handleSaveWallet} disabled={isSaving}>
                      {isSaving ? "Saving…" : "Save address to profile"}
                    </Button>
                  )}
                  {saveSuccess && (
                    <div className="flex items-center gap-2 font-ui text-sm text-ns-success">
                      <CheckCircle2 className="h-4 w-4" /> Saved successfully
                    </div>
                  )}
                  {deleteSuccess && (
                    <div className="flex items-center gap-2 font-ui text-sm text-ns-success">
                      <CheckCircle2 className="h-4 w-4" /> Address removed
                    </div>
                  )}
                  {saveError && (
                    <p className="font-ui text-sm text-ns-destructive">
                      {saveError}
                    </p>
                  )}
                  {addressSaved && (
                    <div className="flex items-center gap-2 font-ui text-xs text-ns-ink-muted">
                      <CheckCircle2 className="h-3.5 w-3.5 text-ns-success" />
                      Address saved to your profile
                    </div>
                  )}
                </div>
              </div>
            )}
          </SettingsSection>

          {savedWalletAddress && (
            <SettingsSection
              kicker="Revenue"
              title="Lifetime earnings"
              description="A running total of reader support received at your saved wallet address."
              icon={TrendingUp}
            >
              {!hasLifetimeEarnings ? (
                <div className="flex items-center gap-4 border-y border-ns-border py-6">
                  <DollarSign className="h-9 w-9 text-ns-ink-muted/40" />
                  <div>
                    <p className="font-ui text-sm font-semibold text-ns-ink">
                      No tips received yet
                    </p>
                    <p className="mt-1 font-body text-sm text-ns-ink-muted">
                      Publish and share your stories to start earning.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid border-y border-ns-border sm:grid-cols-2 sm:divide-x sm:divide-ns-border">
                  <div className="py-5 sm:pr-8">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                      Ether
                    </p>
                    <p className="mt-2 font-heading text-3xl text-emerald-700 tabular-nums dark:text-emerald-400">
                      {parseFloat(lifetimeEarnings.eth).toFixed(4)}
                    </p>
                    <p className="mt-1 font-ui text-xs text-ns-ink-muted">
                      ETH · ≈ $
                      {(parseFloat(lifetimeEarnings.eth) * 3000).toFixed(2)} USD
                    </p>
                  </div>
                  <div className="border-t border-ns-border py-5 sm:border-0 sm:pl-8">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                      USD Coin
                    </p>
                    <p className="mt-2 font-heading text-3xl text-blue-700 tabular-nums dark:text-blue-400">
                      {parseFloat(lifetimeEarnings.usdc).toFixed(2)}
                    </p>
                    <p className="mt-1 font-ui text-xs text-ns-ink-muted">
                      USDC · ≈ ${parseFloat(lifetimeEarnings.usdc).toFixed(2)}{" "}
                      USD
                    </p>
                  </div>
                </div>
              )}
            </SettingsSection>
          )}

          {stories.some(
            (s) =>
              parseFloat(s.earnings.eth) > 0 || parseFloat(s.earnings.usdc) > 0,
          ) && (
            <SettingsSection
              kicker="Ledger"
              title="Story earnings"
              description="See which published work is finding direct support from your readers."
              icon={Coins}
            >
              <div className="divide-y divide-ns-border">
                {stories
                  .filter(
                    (s) =>
                      parseFloat(s.earnings.eth) > 0 ||
                      parseFloat(s.earnings.usdc) > 0,
                  )
                  .map((story) => (
                    <div
                      key={story.id}
                      className="flex flex-col items-start gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <Link
                        to={`/story/${story.id}`}
                        className="line-clamp-1 font-body text-[15px] text-ns-ink transition-colors hover:text-ns-accent"
                      >
                        {story.title}
                      </Link>
                      <div className="flex shrink-0 items-center gap-3 font-ui text-xs">
                        {parseFloat(story.earnings.eth) > 0 && (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {parseFloat(story.earnings.eth).toFixed(4)} ETH
                          </span>
                        )}
                        {parseFloat(story.earnings.usdc) > 0 && (
                          <span className="font-medium text-blue-700 dark:text-blue-400">
                            {parseFloat(story.earnings.usdc).toFixed(2)} USDC
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {(totalEthEarnings > 0 || totalUsdcEarnings > 0) && (
                <div className="mt-2 flex flex-col items-start gap-2 border-t border-ns-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted">
                    Total
                  </span>
                  <div className="flex items-center gap-3 font-ui text-xs">
                    {totalEthEarnings > 0 && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {totalEthEarnings.toFixed(4)} ETH
                      </span>
                    )}
                    {totalUsdcEarnings > 0 && (
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {totalUsdcEarnings.toFixed(2)} USDC
                      </span>
                    )}
                  </div>
                </div>
              )}
            </SettingsSection>
          )}

          <SettingsSection
            kicker="Terms"
            title="Tipping split"
            description={`Readers can tip your stories directly with ETH or USDC on ${TARGET_CHAIN_NAME}.`}
            icon={Percent}
          >
            <div className="border-y border-ns-border py-5">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <span className="font-body text-sm text-ns-ink-secondary">
                  Your share
                </span>
                <span className="font-heading text-2xl text-ns-accent">
                  90%
                </span>
              </div>
              <div
                className="flex h-1.5 overflow-hidden rounded-full bg-ns-border"
                aria-label="90 percent author, 10 percent platform"
              >
                <span className="w-[90%] bg-ns-accent" />
                <span className="w-[10%] bg-ns-ink-muted/45" />
              </div>
              <div className="mt-3 flex justify-between gap-4 font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-ns-ink-muted">
                <span>Author · 90%</span>
                <span>Platform · 10%</span>
              </div>
            </div>
          </SettingsSection>
        </>
      )}
    </section>
  );
};

export default OwnerSettings;
