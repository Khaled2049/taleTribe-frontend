import React, { useState, useEffect, useMemo, useCallback } from "react";
import { X, AlertCircle, Wallet } from "lucide-react";
import { useChainId } from "wagmi";
import { useTippingContract } from "@/hooks/useTippingContract";
import { useUSDCApproval } from "@/hooks/useUSDCApproval";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useWalletState } from "@/hooks/useWalletState";
import { FeePreviewCard } from "@/components/web3/FeePreviewCard";
import { TransactionStatus } from "@/components/web3/TransactionStatus";
import { TransactionStatus as TxStatus } from "@/types/tipping";
import { USDC_ADDRESS } from "@/blockchain/tokens";

interface StoryTipModalProps {
  author: string;
  authorWalletAddress: string;
  storyId: string;
  isOpen: boolean;
  onClose: () => void;
}

type PaymentMethod = "ETH" | "USDC";

const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "31337");

const getTargetChainName = (chainId: number) => {
  if (chainId === 31337) return "Anvil";
  if (chainId === 11155111) return "Sepolia";
  if (chainId === 1) return "Ethereum";
  return `Chain ${chainId}`;
};

// Feature flag: Set to true to enable USDC payments
const USDC_PAYMENTS_ENABLED = false;

export const StoryTipModal: React.FC<StoryTipModalProps> = ({
  author,
  authorWalletAddress,
  storyId,
  isOpen,
  onClose,
}) => {
  const { address } = useWalletState();
  const chainId = useChainId();

  const isConnected = !!address;

  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ETH");
  const [feeSplit, setFeeSplit] = useState<Awaited<
    ReturnType<ReturnType<typeof useTippingContract>["calculateSplit"]>
  > | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Custom Hooks
  const {
    tipAuthorWithETH,
    tipAuthorWithUSDC,
    calculateSplit,
    minimumTipAmount,
    txStatus,
    txHash,
    error: contractError,
    resetTxStatus,
  } = useTippingContract();

  const { checkAllowance, requestApproval, isApproving } = useUSDCApproval();

  // New simplified hook usage
  const {
    ethBalance,
    usdcBalance,
    isLoading: isLoadingBalances,
    refetch: refetchBalances,
  } = useTokenBalance();

  const tipAmounts = [0.001, 0.01, 0.1, 0.5, 1];

  // Helper to get current amount number
  const getTipAmount = useCallback((): number | null => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseFloat(customAmount);
    return null;
  }, [selectedAmount, customAmount]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAmount(null);
      setCustomAmount("");
      // Always default to ETH if USDC is disabled
      setPaymentMethod(USDC_PAYMENTS_ENABLED ? "ETH" : "ETH");
      setFeeSplit(null);
      setInsufficientBalance(false);
      setNeedsApproval(false);
      resetTxStatus();
      refetchBalances(); // Refresh balance on open
    }
  }, [isOpen, resetTxStatus, refetchBalances]);

  // Prevent USDC selection if disabled
  useEffect(() => {
    if (!USDC_PAYMENTS_ENABLED && paymentMethod === "USDC") {
      setPaymentMethod("ETH");
    }
  }, [paymentMethod]);

  // Calculate fee split
  useEffect(() => {
    const amount = getTipAmount();
    if (amount && amount > 0 && isConnected) {
      const calculate = async () => {
        setIsCalculatingFee(true);
        try {
          const split = await calculateSplit(amount.toString());
          setFeeSplit(split);
        } catch (error) {
          console.error("Error calculating fee split:", error);
          setFeeSplit(null);
        } finally {
          setIsCalculatingFee(false);
        }
      };
      calculate();
    } else {
      setFeeSplit(null);
    }
  }, [getTipAmount, calculateSplit, paymentMethod, isConnected]);

  // Check Approval Logic
  const checkUSDCApproval = useCallback(async () => {
    if (!address || paymentMethod !== "USDC" || !USDC_PAYMENTS_ENABLED) return;

    const amount = getTipAmount();
    if (!amount || amount <= 0) {
      setNeedsApproval(false);
      return;
    }

    try {
      const { hasAllowance } = await checkAllowance(amount.toString());
      setNeedsApproval(!hasAllowance);
    } catch (error) {
      console.error("Error checking approval:", error);
    }
  }, [address, paymentMethod, getTipAmount, checkAllowance]);

  // Trigger approval check when dependencies change
  useEffect(() => {
    checkUSDCApproval();
  }, [checkUSDCApproval]);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value);
      setSelectedAmount(null);
    }
  };

  const validateAmount = (): { valid: boolean; error?: string } => {
    const amount = getTipAmount();
    if (!amount || amount <= 0) {
      return { valid: false, error: "Please enter a valid amount" };
    }

    const minAmount = parseFloat(minimumTipAmount);
    if (amount < minAmount) {
      return {
        valid: false,
        error: `Minimum tip amount is ${minAmount} ${paymentMethod}`,
      };
    }

    // Check balance
    const currentBalance =
      paymentMethod === "ETH"
        ? parseFloat(ethBalance)
        : parseFloat(usdcBalance);

    if (amount > currentBalance) {
      setInsufficientBalance(true);
      return {
        valid: false,
        error: `Insufficient ${paymentMethod} balance`,
      };
    }

    setInsufficientBalance(false);
    return { valid: true };
  };

  const handleApprove = async () => {
    const amount = getTipAmount();
    if (!amount || amount <= 0) return;

    try {
      // 1. Request Approval
      await requestApproval(amount.toString());

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 3. Re-check logic
      await checkUSDCApproval();
    } catch (error: unknown) {
      console.error("Approval failed:", error);
    }
  };

  const handleSendTip = async () => {
    if (!isConnected) return alert("Please connect your wallet first");
    if (!isCorrectNetwork) {
      return alert(`Please switch to ${getTargetChainName(TARGET_CHAIN_ID)}`);
    }

    const validation = validateAmount();
    if (!validation.valid) return alert(validation.error);

    const amount = getTipAmount();
    if (!amount) return;

    if (
      !authorWalletAddress ||
      authorWalletAddress === "0x0000000000000000000000000000000000000000"
    ) {
      return alert("Invalid author wallet address");
    }

    try {
      if (paymentMethod === "ETH") {
        await tipAuthorWithETH(authorWalletAddress, storyId, amount.toString());
      } else if (paymentMethod === "USDC" && USDC_PAYMENTS_ENABLED) {
        // USDC Flow
        if (needsApproval) {
          // If button wasn't disabled but we need approval, try approving first
          await handleApprove();
          if (needsApproval) return; // If still needs approval after attempt, stop
        }

        await tipAuthorWithUSDC(
          authorWalletAddress,
          storyId,
          USDC_ADDRESS,
          amount.toString(),
        );
      } else {
        // USDC is disabled
        return alert("USDC payments are not enabled yet");
      }

      // Refresh balances after successful tip
      refetchBalances();
    } catch (error: unknown) {
      console.error("Tip failed:", error);
      // Alerts handled by UI, specific errors can be logged here
    }
  };

  // Logic for enabling the main button
  const canSendTip = useMemo(() => {
    const amount = getTipAmount();
    if (!amount || amount <= 0) return false;
    if (!isConnected || !isCorrectNetwork) return false;

    // Disable if USDC payments are not enabled
    if (paymentMethod === "USDC" && !USDC_PAYMENTS_ENABLED) return false;

    // If USDC and needs approval, the "Send" button is disabled
    // because the "Approve" button (yellow box) handles the approval step.
    if (paymentMethod === "USDC" && needsApproval) return false;

    return true;
  }, [
    getTipAmount,
    isConnected,
    isCorrectNetwork,
    paymentMethod,
    needsApproval,
  ]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900">
            <div>
              <h3 className="text-xl font-bold text-black dark:text-white">
                Support {author}
              </h3>
              <p className="text-sm text-black/60 dark:text-white/60 mt-1">
                Send a tip on {getTargetChainName(TARGET_CHAIN_ID)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white transition-colors"
              disabled={
                txStatus === TxStatus.PENDING ||
                txStatus === TxStatus.CONFIRMING
              }
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {!isConnected ? (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-black/40 dark:text-white/40 mx-auto mb-4" />
                <p className="text-black/70 dark:text-white/70 mb-4">
                  Please connect your wallet to send a tip
                </p>
              </div>
            ) : !isCorrectNetwork ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-black/70 dark:text-white/70 mb-4">
                  Please switch to {getTargetChainName(TARGET_CHAIN_ID)} to send
                  tips
                </p>
              </div>
            ) : (
              <>
                {/* Payment Method Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod("ETH")}
                      className={`py-2 px-4 rounded-lg font-medium transition-all ${
                        paymentMethod === "ETH"
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                    >
                      ETH
                    </button>
                    <button
                      onClick={() => {
                        if (USDC_PAYMENTS_ENABLED) {
                          setPaymentMethod("USDC");
                        }
                      }}
                      disabled={!USDC_PAYMENTS_ENABLED}
                      className={`py-2 px-4 rounded-lg font-medium transition-all relative ${
                        paymentMethod === "USDC" && USDC_PAYMENTS_ENABLED
                          ? "bg-emerald-600 text-white"
                          : USDC_PAYMENTS_ENABLED
                            ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            : "bg-neutral-100 dark:bg-neutral-800 text-black/40 dark:text-white/40 cursor-not-allowed opacity-60"
                      }`}
                      title={
                        !USDC_PAYMENTS_ENABLED
                          ? "USDC payments are not enabled yet"
                          : undefined
                      }
                    >
                      USDC
                      {!USDC_PAYMENTS_ENABLED && (
                        <span className="ml-1 text-xs">(Coming Soon)</span>
                      )}
                    </button>
                  </div>
                  {!USDC_PAYMENTS_ENABLED && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          USDC payments are not enabled yet. Please use ETH (
                          {getTargetChainName(TARGET_CHAIN_ID)}) to send tips.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Balance Display */}
                <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                  <p className="text-sm font-medium text-black/70 dark:text-white/70 mb-2">
                    Current balances
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-white/70 dark:bg-neutral-900/60 p-2">
                      <p className="text-xs text-black/50 dark:text-white/50">
                        ETH
                      </p>
                      <p className="font-medium text-black dark:text-white">
                        {isLoadingBalances
                          ? "Loading..."
                          : `${parseFloat(ethBalance).toFixed(4)} ETH`}
                      </p>
                    </div>
                    <div className="rounded-md bg-white/70 dark:bg-neutral-900/60 p-2">
                      <p className="text-xs text-black/50 dark:text-white/50">
                        USDC
                      </p>
                      <p className="font-medium text-black dark:text-white">
                        {isLoadingBalances
                          ? "Loading..."
                          : `${parseFloat(usdcBalance).toFixed(2)} USDC`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preset amounts */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {tipAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleAmountSelect(amount)}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                        selectedAmount === amount
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                      disabled={
                        txStatus === TxStatus.PENDING ||
                        txStatus === TxStatus.CONFIRMING
                      }
                    >
                      {amount}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-2">
                    Or enter custom amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/50 dark:text-white/50 font-medium">
                      {paymentMethod === "ETH" ? "Ξ" : "$"}
                    </span>
                    <input
                      type="text"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-neutral-100 dark:bg-neutral-800 border-2 border-transparent focus:border-emerald-500 rounded-lg text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 focus:outline-none transition-colors"
                      disabled={
                        txStatus === TxStatus.PENDING ||
                        txStatus === TxStatus.CONFIRMING
                      }
                    />
                  </div>
                  {insufficientBalance && (
                    <p className="text-xs text-red-500 mt-1">
                      Insufficient balance
                    </p>
                  )}
                </div>

                {/* Fee Preview */}
                {feeSplit && (
                  <div className="mb-4">
                    <FeePreviewCard
                      feeSplit={feeSplit}
                      isLoading={isCalculatingFee}
                      tokenSymbol={paymentMethod}
                    />
                  </div>
                )}

                {/* Approval Notice for USDC */}
                {paymentMethod === "USDC" &&
                  USDC_PAYMENTS_ENABLED &&
                  needsApproval && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                            Approval Required
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                            You need to approve USDC spending before sending a
                            tip
                          </p>
                          <button
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {isApproving ? "Approving..." : "Approve USDC"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Wallet info */}
                <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                  <p className="text-xs font-medium text-black/50 dark:text-white/50 mb-1">
                    Recipient Address
                  </p>
                  <p className="text-xs font-mono text-black/70 dark:text-white/70 break-all">
                    {authorWalletAddress}
                  </p>
                </div>

                {/* Send button */}
                <button
                  onClick={handleSendTip}
                  disabled={
                    !canSendTip ||
                    txStatus === TxStatus.PENDING ||
                    txStatus === TxStatus.CONFIRMING ||
                    isApproving
                  }
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white disabled:text-neutral-500 dark:disabled:text-neutral-400 rounded-lg font-semibold transition-all disabled:cursor-not-allowed shadow-sm"
                >
                  {txStatus === TxStatus.PENDING ||
                  txStatus === TxStatus.CONFIRMING
                    ? "Processing..."
                    : `Send ${
                        getTipAmount()
                          ? `${getTipAmount()} ${paymentMethod}`
                          : "Tip"
                      }`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Status Modal */}
      <TransactionStatus
        status={txStatus}
        txHash={txHash || undefined}
        error={contractError}
        isOpen={
          txStatus === TxStatus.PENDING ||
          txStatus === TxStatus.CONFIRMING ||
          txStatus === TxStatus.SUCCESS ||
          txStatus === TxStatus.ERROR
        }
        onClose={() => {
          if (txStatus === TxStatus.SUCCESS || txStatus === TxStatus.ERROR) {
            resetTxStatus();
            onClose();
          }
        }}
      />
    </>
  );
};
