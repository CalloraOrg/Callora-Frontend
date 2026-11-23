import { useRuntimeConfig, useRuntimeConfigStatus } from "../config/runtimeConfig";
import { getWalletNetworkLabel, useWalletStore } from "../state/walletStore";

export default function RuntimeConfigBanner() {
  const config = useRuntimeConfig();
  const { usedFallback } = useRuntimeConfigStatus();
  const wallet = useWalletStore();

  if (!usedFallback && !wallet.isNetworkMismatch) return null;

  return (
    <div className="status-banner" role="alert" style={{ margin: "12px 24px" }}>
      <div>
        {wallet.isNetworkMismatch && (
          <p>
            Freighter is connected to {getWalletNetworkLabel(wallet.networkPassphrase)}, while this app
            uses {config.network}. Switch networks before signing transactions.
          </p>
        )}
        {usedFallback && (
          <p>Runtime configuration could not be loaded. The build-time configuration is in use.</p>
        )}
      </div>
    </div>
  );
}
