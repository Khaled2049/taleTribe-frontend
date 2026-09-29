import { WEB3_ENABLED } from "@/config/featureFlags";

export async function disconnectWalletIfConnected() {
  if (!WEB3_ENABLED) return;
  const [{ disconnect, getAccount }, { wagmiConfig }] = await Promise.all([
    import("wagmi/actions"),
    import("./config"),
  ]);
  if (getAccount(wagmiConfig).isConnected) {
    await disconnect(wagmiConfig);
  }
}
