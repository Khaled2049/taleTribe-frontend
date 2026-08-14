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
import { userService } from "@/services/UserService";
import { getApiErrorMessage } from "@/api";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/web3/WalletConnectButton";
import { WEB3_ENABLED } from "@/config/featureFlags";
import {
  DollarSign,
  Loader2,
  Copy,
  CheckCircle2,
  Trash2,
  Sun,
  Moon,
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

const Card = ({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-ns-elevated border border-ns-border rounded-ns-xl p-6 mb-5 ${className}`}
  >
    {title && (
      <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-5">
        {title}
      </p>
    )}
    {children}
  </div>
);

const Row = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col items-start gap-3 py-4 border-b border-ns-border last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div>
      <p className="text-sm font-ui font-medium text-ns-ink">{label}</p>
      {description && (
        <p className="text-xs font-ui text-ns-ink-muted mt-0.5">
          {description}
        </p>
      )}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
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
      <Button
        variant="outline"
        disabled={requesting}
        onClick={() => request()}
      >
        {requesting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Request access"
        )}
      </Button>
    );
  };

  return (
    <Card title="MCP Access">
      <Row
        label="Connect Claude to your stories"
        description={
          status === "granted"
            ? "Add the NovelSync connector in Claude to read and draft your stories."
            : status === "revoked"
              ? "Access was turned off for this account. You can request it again and we'll take another look."
              : "MCP is in limited testing. Request access and we'll review it."
        }
      >
        {body()}
      </Row>
      {error && (
        <p className="text-xs font-ui text-red-500 pt-3">{error}</p>
      )}
    </Card>
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
    <Card title="AI Credits">
      <Row
        label="Available credits"
        description="Spent on platform AI features like co-write."
      >
        <span className="font-heading text-2xl text-ns-ink tabular-nums">
          {isLoading
            ? "…"
            : isError
              ? "—"
              : (data?.availableCredits ?? 0).toLocaleString()}
        </span>
      </Row>

      <div className="pt-4">
        <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-3">
          Top up
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CREDIT_TIERS.map((amount) => {
            const pending =
              purchase.isPending && purchase.variables === amount;
            return (
              <Button
                key={amount}
                variant="outline"
                disabled={purchase.isPending}
                onClick={() => handlePurchase(amount)}
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
    </Card>
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
      await userService.updateUserWalletAddress(user.uid, connectedAddress);
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
      await userService.clearUserWalletAddress(user.uid);
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
    <section className="mt-6">
      <p className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest mb-5">
        Settings
      </p>

      {/* ── Appearance ── */}
      <Card title="Appearance">
        <Row
          label="Theme"
          description={`Currently using ${theme === "light" ? "light" : "dark"} theme`}
        >
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 text-sm font-ui font-medium bg-ns-surface border border-ns-border hover:bg-ns-surface-hover text-ns-ink rounded-ns transition-colors"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4" /> Switch to Dark
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" /> Switch to Light
              </>
            )}
          </button>
        </Row>
      </Card>

      {/* ── AI Provider (AiSettings renders its own card) ── */}
      <Suspense
        fallback={
          <div className="h-32 mb-6 rounded-ns-xl border border-ns-border animate-pulse bg-ns-surface" />
        }
      >
        <AiSettings />
      </Suspense>

      {/* ── AI Credits (platform users only; BYOK users don't spend credits) ── */}
      {!user?.hasCustomAiProvider && <AiCreditsCard userId={user?.uid} />}

      {/* ── $TALE token balance + daily faucet claim ── */}
      <div className="mb-5">
        <SidebarBalanceCard />
      </div>

      {/* ── MCP access (limited rollout; owner approves each account) ── */}
      <McpAccessCard userId={user?.uid} />

      {/* ── Wallet & Earnings ── */}
      {WEB3_ENABLED && (
        <>
          <Card title="Wallet Connection">
            {!isWalletConnected ? (
              <div className="space-y-3">
                <p className="text-sm font-ui text-ns-ink-secondary">
                  Connect your wallet to receive tips from readers on the
                  {TARGET_CHAIN_NAME} network.
                </p>
                <WalletConnectButton />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status pill */}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isCorrectNetwork ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-sm font-ui text-ns-ink">
                    {isCorrectNetwork
                      ? `Connected · ${TARGET_CHAIN_NAME}`
                      : `Wrong network — please switch to ${TARGET_CHAIN_NAME}`}
                  </span>
                </div>

                {/* Address row */}
                <div>
                  <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-2">
                    Address
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 text-xs font-mono bg-ns-surface border border-ns-border rounded-ns text-ns-ink truncate">
                      {connectedAddress}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyAddress}
                      className="p-2 rounded-ns border border-ns-border bg-ns-surface hover:bg-ns-surface-hover text-ns-ink-muted hover:text-ns-ink transition-colors"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-ns-accent" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    {savedWalletAddress && (
                      <button
                        onClick={handleDeleteWallet}
                        disabled={isDeleting}
                        className="p-2 rounded-ns border border-ns-border bg-ns-surface hover:bg-red-50 dark:hover:bg-red-500/10 text-ns-ink-muted hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove saved address"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Save to profile */}
                {!addressSaved && (
                  <button
                    onClick={handleSaveWallet}
                    disabled={isSaving}
                    className="w-full py-2 text-sm font-ui font-medium bg-ns-accent hover:bg-ns-accent-hover text-white rounded-ns transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving…" : "Save address to profile"}
                  </button>
                )}
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-sm font-ui text-ns-accent">
                    <CheckCircle2 className="w-4 h-4" /> Saved successfully
                  </div>
                )}
                {deleteSuccess && (
                  <div className="flex items-center gap-2 text-sm font-ui text-ns-accent">
                    <CheckCircle2 className="w-4 h-4" /> Address removed
                  </div>
                )}
                {saveError && (
                  <p className="text-sm font-ui text-ns-destructive">
                    {saveError}
                  </p>
                )}
                {addressSaved && (
                  <div className="flex items-center gap-2 text-xs font-ui text-ns-ink-muted">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ns-accent" />
                    Address saved to your profile
                  </div>
                )}
              </div>
            )}
          </Card>

          {savedWalletAddress && (
            <Card title="Lifetime Earnings">
              {!hasLifetimeEarnings ? (
                <div className="py-8 text-center">
                  <DollarSign className="w-10 h-10 text-ns-ink-muted/30 mx-auto mb-3" />
                  <p className="text-sm font-ui text-ns-ink-secondary">
                    No tips received yet.
                  </p>
                  <p className="text-xs font-ui text-ns-ink-muted mt-1">
                    Share your stories to start earning!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-ns-surface border border-ns-border rounded-ns">
                    <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-2">
                      ETH
                    </p>
                    <p className="font-heading text-2xl text-emerald-600 dark:text-emerald-400">
                      {parseFloat(lifetimeEarnings.eth).toFixed(4)}
                    </p>
                    <p className="text-xs font-ui text-ns-ink-muted mt-1">
                      ≈ ${(parseFloat(lifetimeEarnings.eth) * 3000).toFixed(2)}{" "}
                      USD
                    </p>
                  </div>
                  <div className="p-4 bg-ns-surface border border-ns-border rounded-ns">
                    <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-2">
                      USDC
                    </p>
                    <p className="font-heading text-2xl text-blue-600 dark:text-blue-400">
                      {parseFloat(lifetimeEarnings.usdc).toFixed(2)}
                    </p>
                    <p className="text-xs font-ui text-ns-ink-muted mt-1">
                      ≈ ${parseFloat(lifetimeEarnings.usdc).toFixed(2)} USD
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {stories.some(
            (s) =>
              parseFloat(s.earnings.eth) > 0 ||
              parseFloat(s.earnings.usdc) > 0,
          ) && (
            <Card title="Per-Story Earnings">
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
                      className="flex flex-col items-start py-3.5 gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <Link
                        to={`/story/${story.id}`}
                        className="text-sm font-ui text-ns-ink hover:text-ns-accent transition-colors line-clamp-1"
                      >
                        {story.title}
                      </Link>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs font-ui">
                        {parseFloat(story.earnings.eth) > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {parseFloat(story.earnings.eth).toFixed(4)} ETH
                          </span>
                        )}
                        {parseFloat(story.earnings.usdc) > 0 && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {parseFloat(story.earnings.usdc).toFixed(2)} USDC
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {(totalEthEarnings > 0 || totalUsdcEarnings > 0) && (
                <div className="mt-4 pt-4 border-t border-ns-border flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted">
                    Total
                  </span>
                  <div className="flex items-center gap-3 text-xs font-ui">
                    {totalEthEarnings > 0 && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {totalEthEarnings.toFixed(4)} ETH
                      </span>
                    )}
                    {totalUsdcEarnings > 0 && (
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {totalUsdcEarnings.toFixed(2)} USDC
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card title="How Tipping Works">
            <div className="space-y-3 text-sm font-ui text-ns-ink-secondary">
              <p>
                Readers can tip you directly for your stories using ETH or USDC
                on {TARGET_CHAIN_NAME}.
              </p>
              <div className="bg-ns-surface border border-ns-border rounded-ns p-4">
                <p className="text-[10px] font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-3">
                  Revenue Split
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ns-ink-secondary">Author (You)</span>
                    <span className="font-semibold text-ns-accent">90%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ns-ink-secondary">Platform Fee</span>
                    <span className="text-ns-ink-muted">10%</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </section>
  );
};

export default OwnerSettings;
