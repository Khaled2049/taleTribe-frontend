import React, { useEffect, useRef } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader,
  XCircle,
  LogOut,
  Copy,
  ChevronDown,
} from "lucide-react";
import { useWalletState, WalletState } from "@/hooks/useWalletState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { profileRepo } from "@/services/ProfileRepo";
import { useChainId } from "wagmi";

const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "31337");

const getNetworkName = (chainId: number | undefined) => {
  if (!chainId) return "Unknown";
  if (chainId === 31337) return "Anvil";
  if (chainId === 11155111) return "Sepolia";
  if (chainId === 1) return "Ethereum";
  return `Chain ${chainId}`;
};

export const WalletConnectButton: React.FC = () => {
  const chainId = useChainId();
  const { user } = useAuthContext();
  const {
    state,
    address,
    error,
    connectWallet,
    disconnectWallet,
    switchToTargetChain,
    isConnecting,
    isDisconnecting,
  } = useWalletState();

  const prevStateRef = useRef<WalletState>(WalletState.DISCONNECTED);
  const isFirstRenderRef = useRef(true);
  const [savedWalletAddress, setSavedWalletAddress] = React.useState<
    string | null
  >(user?.walletAddress || null);
  const [showReplaceWalletDialog, setShowReplaceWalletDialog] =
    React.useState(false);
  const [isUpdatingWalletAddress, setIsUpdatingWalletAddress] =
    React.useState(false);

  useEffect(() => {
    setSavedWalletAddress(user?.walletAddress || null);
  }, [user?.walletAddress]);

  useEffect(() => {
    if (
      state !== WalletState.DISCONNECTED &&
      address &&
      savedWalletAddress &&
      savedWalletAddress.toLowerCase() !== address.toLowerCase()
    ) {
      setShowReplaceWalletDialog(true);
    }
  }, [state, address, savedWalletAddress]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevStateRef.current = state;
      return;
    }

    if (prevStateRef.current === state) return;

    if (
      state === WalletState.READY &&
      prevStateRef.current === WalletState.DISCONNECTED
    ) {
      toast.success("Wallet connected successfully", {
        description: `Connected to ${getNetworkName(chainId)} network`,
      });
    }

    if (state === WalletState.WRONG_NETWORK) {
      toast.warning("Wrong network detected", {
        description: `Please switch to ${getNetworkName(TARGET_CHAIN_ID)}`,
        duration: 5000,
      });
    }

    if (state === WalletState.ERROR && error) {
      toast.error("Wallet connection error", {
        description: error.message,
        duration: 5000,
      });
    }

    prevStateRef.current = state;
  }, [state, error, chainId]);

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";
      toast.error(errorMessage);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      toast.success("Wallet disconnected successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to disconnect wallet";
      toast.error(errorMessage);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchToTargetChain();
      toast.success(`Switched to ${getNetworkName(TARGET_CHAIN_ID)}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to switch network";
      toast.error(errorMessage);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    } catch {
      toast.error("Failed to copy address");
    }
  };

  const handleConfirmWalletReplacement = async () => {
    if (!user?.uid || !address) {
      toast.error("Unable to update wallet address");
      return;
    }

    setIsUpdatingWalletAddress(true);
    try {
      await profileRepo.updateMe({ walletAddress: address });
      setSavedWalletAddress(address);
      setShowReplaceWalletDialog(false);
      toast.success("Wallet address updated", {
        description: "Future tip payouts will use this new wallet address.",
      });
    } catch (updateErr) {
      const updateMessage =
        updateErr instanceof Error
          ? updateErr.message
          : "Failed to update wallet address";
      toast.error("Could not update wallet address", {
        description: updateMessage,
      });
    } finally {
      setIsUpdatingWalletAddress(false);
    }
  };

  const handleKeepOriginalWallet = async () => {
    setShowReplaceWalletDialog(false);
    try {
      await disconnectWallet();
      toast.info("Original wallet kept", {
        description: "Your existing payout wallet remains unchanged.",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to disconnect wallet";
      toast.error(errorMessage);
    }
  };

  if (!user) {
    return null;
  }

  const stateConfig = {
    [WalletState.READY]: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      text: null,
      detail: `${getNetworkName(chainId)} Network`,
    },
    [WalletState.WRONG_NETWORK]: {
      icon: <AlertCircle className="w-4 h-4 text-yellow-500" />,
      text: "Wrong Network",
      detail: `Chain ID: ${chainId || "Unknown"}`,
    },
    [WalletState.CONNECTING]: {
      icon: <Loader className="w-4 h-4 animate-spin text-blue-500" />,
      text: "Connecting...",
      detail: "Connecting...",
    },
    [WalletState.CONNECTED]: {
      icon: <Loader className="w-4 h-4 animate-spin text-blue-500" />,
      text: "Connecting...",
      detail: "Connecting...",
    },
    [WalletState.ERROR]: {
      icon: <XCircle className="w-4 h-4 text-red-500" />,
      text: "Error",
      detail: error?.message || "Connection Error",
    },
    [WalletState.DISCONNECTED]: {
      icon: null,
      text: null,
      detail: "Disconnected",
    },
  };

  const currentState =
    stateConfig[state] || stateConfig[WalletState.DISCONNECTED];
  const savedAddressShort = savedWalletAddress
    ? `${savedWalletAddress.slice(0, 6)}...${savedWalletAddress.slice(-4)}`
    : null;
  const newAddressShort = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  const replaceWalletDialog = (
    <Dialog
      open={showReplaceWalletDialog}
      onOpenChange={(open) => {
        if (isUpdatingWalletAddress) return;
        setShowReplaceWalletDialog(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update payout wallet address?</DialogTitle>
          <DialogDescription>
            We noticed you connected a different wallet than the one currently
            on your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-2">
          <p className="text-xs text-black/70 dark:text-white/70">
            Current saved wallet:{" "}
            <span className="font-mono text-black dark:text-white">
              {savedAddressShort}
            </span>
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">
            Newly connected wallet:{" "}
            <span className="font-mono text-black dark:text-white">
              {newAddressShort}
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleKeepOriginalWallet}
            disabled={isUpdatingWalletAddress}
          >
            Keep Existing Wallet
          </Button>
          <Button
            onClick={handleConfirmWalletReplacement}
            disabled={isUpdatingWalletAddress}
            className="bg-ns-accent hover:bg-ns-accent-hover text-white"
          >
            {isUpdatingWalletAddress ? "Updating..." : "Use New Wallet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (address && state !== WalletState.DISCONNECTED) {
    const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
      <>
        {replaceWalletDialog}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-ns hover:bg-ns-surface transition-colors focus:outline-none focus:ring-2 focus:ring-ns-accent focus:ring-offset-2"
              disabled={isDisconnecting}
            >
              {currentState.icon}
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium text-ns-ink">
                  {truncatedAddress}
                </span>
                {currentState.text && (
                  <span className="text-xs text-ns-ink-muted">
                    {currentState.text}
                  </span>
                )}
              </div>
              <ChevronDown className="w-3 h-3 text-ns-ink-muted ml-1" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-ns-elevated border border-ns-border"
          >
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ns-ink">
                  Wallet Address
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ns-ink-secondary truncate">
                    {address}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1 hover:bg-ns-surface rounded transition-colors flex-shrink-0"
                    title="Copy address"
                  >
                    <Copy className="w-3 h-3 text-ns-ink-muted" />
                  </button>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ns-ink">
                  Network Status
                </span>
                <div className="flex items-center gap-2">
                  {currentState.icon}
                  <span className="text-xs text-ns-ink-secondary">
                    {currentState.detail}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            {state === WalletState.WRONG_NETWORK && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSwitchNetwork}
                  className="cursor-pointer"
                >
                  Switch to {getNetworkName(TARGET_CHAIN_ID)}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-red-500 focus:text-red-600 focus:bg-red-500/10 dark:focus:bg-red-500/10 cursor-pointer"
            >
              {isDisconnecting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect Wallet
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  return (
    <>
      {replaceWalletDialog}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-5 py-2 bg-ns-accent hover:bg-ns-accent-hover text-white font-ui font-semibold rounded-full transition-all duration-300 hover:scale-105 shadow-ns-sm hover:shadow-ns text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    </>
  );
};
