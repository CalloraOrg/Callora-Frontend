export type WalletNetwork = {
  networkPassphrase: string | null;
};

export type WalletTransactionSignature = {
  signedTxXdr: string;
  signerAddress: string;
};

export type WalletWatchUpdate = {
  address: string | null;
  networkPassphrase: string | null;
  error?: Error;
};

export interface WalletAdapter {
  readonly id: string;
  readonly name: string;
  readonly installUrl: string;
  readonly capabilities: {
    signMessage: boolean;
  };
  isAvailable(): Promise<boolean>;
  connect(): Promise<{ address: string }>;
  getAddress(): Promise<string | null>;
  getNetwork(): Promise<WalletNetwork>;
  signTransaction(
    xdr: string,
    options: { networkPassphrase: string; address: string },
  ): Promise<WalletTransactionSignature>;
  signMessage?(
    message: string,
    options: { address: string },
  ): Promise<string>;
  watch?(callback: (wallet: WalletWatchUpdate) => void): () => void;
}

export class WalletAdapterError extends Error {
  constructor(
    message: string,
    readonly code:
      | "UNAVAILABLE"
      | "USER_REJECTED"
      | "NETWORK_MISMATCH"
      | "ERROR",
  ) {
    super(message);
    this.name = "WalletAdapterError";
  }
}

export function isUserRejectedWalletError(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message).toLowerCase()
      : String(error).toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? Number(error.code)
      : Number.NaN;

  return (
    code === 4001 ||
    code === -4 ||
    message.includes("reject") ||
    message.includes("declin") ||
    message.includes("cancel") ||
    message.includes("user denied")
  );
}
