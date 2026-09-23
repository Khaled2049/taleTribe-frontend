import React, { useState, useEffect, lazy, Suspense } from "react";
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
import { Loader2, Copy, CheckCircle2, Trash2, Sun, Moon } from "lucide-react";
import {
  Segmented,
  SettingsColumn,
  SettingsPanel,
  StatusDot,
} from "./SettingsPanel";

const AiSettings = lazy(() => import("@/routes/Settings/AiSettings"));

const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "31337");
const TARGET_CHAIN_NAME =
  TARGET_CHAIN_ID === 31337
    ? "Anvil"
    : TARGET_CHAIN_ID === 11155111
      ? "Sepolia"
      : TARGET_CHAIN_ID === 1
        ? "Ethereum"
        : `Chain ${TARGET_CHAIN_ID}`;

// Preset top-up tiers (MVP: no payment). Must match ALLOWED_CREDIT_TIERS in the
// Firebase Function / agent service, which reject any other amount.
const CREDIT_TIERS = [10000, 50000, 100000];

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

const McpAccessCard: React.FC<{ userId: string | undefined }> = ({
  userId,
}) => {
  const { status, loading, requesting, error, request } = useMcpAccess(userId);

  const meta = loading ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-ns-ink-muted" />
  ) : status === "granted" ? (
    <StatusDot tone="ok">Enabled</StatusDot>
  ) : status === "requested" ? (
    <StatusDot tone="warn">Pending</StatusDot>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={requesting}
      onClick={() => request()}
      className="rounded-full bg-transparent shadow-none"
    >
      {requesting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        "Request access"
      )}
    </Button>
  );

  return (
    <SettingsPanel title="Claude connector" meta={meta}>
      <p className="font-body text-sm text-ns-ink-muted">
        {status === "granted"
          ? "Add TheTaleTribe in Claude to read and draft your stories."
          : status === "revoked"
            ? "Access was turned off. You can request it again."
            : "Let Claude read your stories. Limited beta."}
      </p>
      {error && (
        <p className="mt-2 font-ui text-xs text-ns-destructive">{error}</p>
      )}
    </SettingsPanel>
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
    <SettingsPanel title="Credits">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-light leading-none text-ns-ink tabular-nums">
            {isLoading
              ? "…"
              : isError
                ? "—"
                : (data?.availableCredits ?? 0).toLocaleString()}
          </span>
          <span className="font-ui text-xs text-ns-ink-muted">credits</span>
        </div>
        <div className="flex gap-1.5">
          {CREDIT_TIERS.map((amount) => {
            const pending = purchase.isPending && purchase.variables === amount;
            return (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                disabled={purchase.isPending}
                onClick={() => handlePurchase(amount)}
                aria-label={`Add ${amount.toLocaleString()} credits`}
                className="min-w-14 rounded-full bg-transparent px-3 font-ui text-xs tabular-nums shadow-none"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  `+${compact.format(amount)}`
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {justAdded !== null && (
        <p className="mt-3 flex items-center gap-1.5 font-ui text-xs text-ns-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Added{" "}
          {justAdded.toLocaleString()}
        </p>
      )}
      {purchase.isError && (
        <p className="mt-3 font-ui text-xs text-ns-destructive">
          {getApiErrorMessage(purchase.error, "Failed to purchase credits")}
        </p>
      )}
      {isError && !purchase.isError && (
        <p className="mt-3 font-ui text-xs text-ns-ink-muted">
          Couldn&apos;t load your balance.
        </p>
      )}
    </SettingsPanel>
  );
};

const OwnerSettings: React.FC<{ identity: React.ReactNode }> = ({
  identity,
}) => {
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

  const earningStories = stories.filter(
    (s) => parseFloat(s.earnings.eth) > 0 || parseFloat(s.earnings.usdc) > 0,
  );

  return (
    <div className="mt-12 grid animate-ns-fade-in gap-12 lg:grid-cols-2 lg:gap-16">
      <SettingsColumn title="Profile">
        <SettingsPanel title="Identity">{identity}</SettingsPanel>

        <SettingsPanel
          title="Theme"
          meta={
            <Segmented
              label="Color theme"
              value={theme}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
              ]}
              onChange={(next) => {
                if (next !== theme) toggleTheme();
              }}
            />
          }
        />

        <SettingsPanel title="$TALE">
          <SidebarBalanceCard />
        </SettingsPanel>

        {WEB3_ENABLED && (
          <SettingsPanel
            title="Wallet"
            meta={
              isWalletConnected ? (
                <StatusDot tone={isCorrectNetwork ? "ok" : "warn"}>
                  {isCorrectNetwork
                    ? TARGET_CHAIN_NAME
                    : `Switch to ${TARGET_CHAIN_NAME}`}
                </StatusDot>
              ) : (
                <WalletConnectButton />
              )
            }
          >
            {isWalletConnected && (
              <>
                <div className="flex items-center gap-2 border-b border-ns-border pb-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-ns-ink">
                    {connectedAddress}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="p-1 text-ns-ink-muted transition-colors hover:text-ns-ink"
                    aria-label="Copy wallet address"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-ns-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {savedWalletAddress && (
                    <button
                      type="button"
                      onClick={handleDeleteWallet}
                      disabled={isDeleting}
                      className="p-1 text-ns-ink-muted transition-colors hover:text-ns-destructive disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Remove saved address"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-3 font-ui text-xs">
                  {saveError ? (
                    <span className="text-ns-destructive">{saveError}</span>
                  ) : saveSuccess ? (
                    <span className="text-ns-success">Saved to profile</span>
                  ) : deleteSuccess ? (
                    <span className="text-ns-success">Address removed</span>
                  ) : addressSaved ? (
                    <span className="flex items-center gap-1.5 text-ns-ink-muted">
                      <CheckCircle2 className="h-3.5 w-3.5 text-ns-success" />
                      On your profile
                    </span>
                  ) : (
                    <span className="text-ns-ink-muted">
                      Not on your profile
                    </span>
                  )}
                  {!addressSaved && (
                    <Button
                      size="sm"
                      onClick={handleSaveWallet}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving…" : "Save to profile"}
                    </Button>
                  )}
                </div>
              </>
            )}
            <p
              className={`font-ui text-xs text-ns-ink-muted ${isWalletConnected ? "mt-4" : ""}`}
            >
              Tips in ETH or USDC · you keep 90%
            </p>
          </SettingsPanel>
        )}

        {WEB3_ENABLED && savedWalletAddress && (
          <SettingsPanel title="Earnings">
            {!hasLifetimeEarnings ? (
              <p className="font-body text-sm text-ns-ink-muted">
                No tips yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading text-3xl font-light leading-none text-ns-ink tabular-nums">
                    {parseFloat(lifetimeEarnings.eth).toFixed(4)}
                  </span>
                  <span className="font-ui text-xs text-ns-ink-muted">ETH</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading text-3xl font-light leading-none text-ns-ink tabular-nums">
                    {parseFloat(lifetimeEarnings.usdc).toFixed(2)}
                  </span>
                  <span className="font-ui text-xs text-ns-ink-muted">
                    USDC
                  </span>
                </div>
              </div>
            )}

            {earningStories.length > 0 && (
              <ul className="mt-5 divide-y divide-ns-border border-t border-ns-border">
                {earningStories.map((story) => (
                  <li
                    key={story.id}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <Link
                      to={`/story/${story.id}`}
                      className="line-clamp-1 font-body text-sm text-ns-ink transition-colors hover:text-ns-accent"
                    >
                      {story.title}
                    </Link>
                    <span className="flex shrink-0 gap-3 font-ui text-xs tabular-nums text-ns-ink-secondary">
                      {parseFloat(story.earnings.eth) > 0 && (
                        <span>
                          {parseFloat(story.earnings.eth).toFixed(4)} ETH
                        </span>
                      )}
                      {parseFloat(story.earnings.usdc) > 0 && (
                        <span>
                          {parseFloat(story.earnings.usdc).toFixed(2)} USDC
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SettingsPanel>
        )}
      </SettingsColumn>

      <SettingsColumn title="AI">
        <Suspense
          fallback={
            <div className="py-7">
              <div className="h-56 animate-pulse rounded-ns bg-ns-surface" />
            </div>
          }
        >
          <AiSettings />
        </Suspense>

        {!user?.hasCustomAiProvider && <AiCreditsCard userId={user?.uid} />}

        <McpAccessCard userId={user?.uid} />
      </SettingsColumn>
    </div>
  );
};

export default OwnerSettings;
