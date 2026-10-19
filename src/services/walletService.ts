import {
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Address,
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Operation,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import {
  STELLAR_NETWORK,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
  STELLAR_USDC_DECIMALS,
  STELLAR_USDC_ASSET,
  STELLAR_USDC_CONFIGURATION_ERROR,
  STELLAR_VAULT_CONTRACT_ID,
  type StellarNetwork,
} from "../config/constants";

const STELLAR_NETWORK_LABELS: Record<StellarNetwork, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
  futurenet: "Futurenet",
};

const RPC_TIMEOUT_MS = 8_000;
const TRANSACTION_TIMEOUT_SECONDS = 120;
const CONFIRMATION_TIMEOUT_MS = 30_000;
const CONFIRMATION_POLL_INTERVAL_MS = 1_000;

export type WalletServiceErrorCode =
  | "WALLET_UNAVAILABLE"
  | "SIGNATURE_REJECTED"
  | "NETWORK_TIMEOUT"
  | "NETWORK_MISMATCH"
  | "CONFIGURATION"
  | "INVALID_AMOUNT"
  | "TRUSTLINE_MISSING"
  | "UNFUNDED_ACCOUNT"
  | "TRANSACTION_FAILED"
  | "WALLET_ERROR"
  | "NETWORK_ERROR";

export class WalletServiceError extends Error {
  readonly code: WalletServiceErrorCode;
  readonly requiresReconciliation: boolean;

  constructor(
    code: WalletServiceErrorCode,
    message: string,
    requiresReconciliation = false,
  ) {
    super(message);
    this.name = "WalletServiceError";
    this.code = code;
    this.requiresReconciliation = requiresReconciliation;
  }
}

export interface SubmittedDeposit {
  hash: string;
}

type OnSubmitted = (hash: string) => void;

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "";
}

function isUserRejection(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? Number(error.code)
      : Number.NaN;

  return (
    code === 4001 ||
    message.includes("reject") ||
    message.includes("declin") ||
    message.includes("cancel")
  );
}

function throwWalletError(error: unknown): never {
  if (isUserRejection(error)) {
    throw new WalletServiceError(
      "SIGNATURE_REJECTED",
      "Signature rejected. No funds were added to the vault.",
    );
  }

  throw new WalletServiceError(
    "WALLET_ERROR",
    getErrorMessage(error) || "The Stellar wallet could not complete the request.",
  );
}

function toUsdcStroops(amount: string | number): bigint {
  const amountText = String(amount).trim();
  const decimalPattern = new RegExp(
    `^\\d+(?:\\.\\d{0,${STELLAR_USDC_DECIMALS}})?$`,
  );

  if (!decimalPattern.test(amountText)) {
    throw new WalletServiceError(
      "INVALID_AMOUNT",
      `USDC deposits support up to ${STELLAR_USDC_DECIMALS} decimal places.`,
    );
  }

  const [whole, fraction = ""] = amountText.split(".");
  const scale = 10n ** BigInt(STELLAR_USDC_DECIMALS);
  const fractionalStroops = BigInt(
    fraction.padEnd(STELLAR_USDC_DECIMALS, "0") || "0",
  );
  const amountStroops = BigInt(whole) * scale + fractionalStroops;

  if (amountStroops <= 0n) {
    throw new WalletServiceError("INVALID_AMOUNT", "Deposit amount must be greater than zero.");
  }

  return amountStroops;
}

export async function isWalletAvailable(): Promise<boolean> {
  try {
    const connection = await isConnected();
    return connection.isConnected;
  } catch {
    return false;
  }
}

export type UsdcTrustlineStatus = "present" | "missing" | "unfunded-account" | "unknown";

function validateUsdcConfiguration(): void {
  if (STELLAR_USDC_CONFIGURATION_ERROR) {
    throw new WalletServiceError("CONFIGURATION", STELLAR_USDC_CONFIGURATION_ERROR);
  }
}

async function horizonRequest(path: string, options?: RequestInit, timeoutMs = RPC_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${STELLAR_HORIZON_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** A failed lookup is not evidence that an account lacks a trustline. */
export async function hasUsdcTrustline(address: string): Promise<UsdcTrustlineStatus> {
  validateUsdcConfiguration();
  try {
    const response = await horizonRequest(`/accounts/${encodeURIComponent(address)}`);
    if (response.status === 404) return "unfunded-account";
    if (!response.ok) return "unknown";
    const account = await response.json();
    if (!Array.isArray(account?.balances)) return "unknown";
    return account.balances.some((balance: { asset_code?: string; asset_issuer?: string } | null) =>
      balance?.asset_code === STELLAR_USDC_ASSET.code &&
      balance?.asset_issuer === STELLAR_USDC_ASSET.issuer,
    ) ? "present" : "missing";
  } catch {
    return "unknown";
  }
}

/** Connect Freighter and ensure every action targets the configured network. */
export async function getWalletAddress(): Promise<string> {
  if (!(await isWalletAvailable())) {
    throw new WalletServiceError("WALLET_UNAVAILABLE", "Freighter is not installed or available in this browser.");
  }
  try {
    const access = await requestAccess();
    if (access.error) throw access.error;
    if (!access.address) {
      throw new WalletServiceError("WALLET_UNAVAILABLE", "Freighter did not provide an account address. Connect an account and try again.");
    }
    const network = await getNetwork();
    if (network.error) throw network.error;
    if (network.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
      throw new WalletServiceError("NETWORK_MISMATCH", `Switch Freighter to Stellar ${STELLAR_NETWORK_LABELS[STELLAR_NETWORK]} and try again.`);
    }
    return access.address;
  } catch (error) {
    if (error instanceof WalletServiceError) throw error;
    throwWalletError(error);
  }
}

/** Horizon's synchronous submission waits until the transaction reaches a ledger. */
export async function addUsdcTrustline(): Promise<"present" | "cancelled"> {
  validateUsdcConfiguration();
  try {
    const address = await getWalletAddress();
    const response = await horizonRequest(`/accounts/${encodeURIComponent(address)}`);
    if (response.status === 404) {
      throw new WalletServiceError("UNFUNDED_ACCOUNT", "Fund this Stellar account with XLM before adding a USDC trustline.");
    }
    if (!response.ok) throw new Error("Could not load the Stellar account.");
    const account = await response.json();
    const transaction = new TransactionBuilder(new Account(address, account.sequence), {
      fee: BASE_FEE,
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.changeTrust({
        asset: new Asset(STELLAR_USDC_ASSET.code, STELLAR_USDC_ASSET.issuer),
      }))
      .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
      .build();

    const signature = await signTransaction(transaction.toXDR(), {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      address,
    });
    if (signature.error) throw signature.error;
    if (!signature.signedTxXdr || signature.signerAddress !== address) {
      throw new WalletServiceError("WALLET_ERROR", "Freighter did not sign the trustline with the connected account.");
    }
    const submission = await horizonRequest("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ tx: signature.signedTxXdr }).toString(),
    }, CONFIRMATION_TIMEOUT_MS);
    if (!submission.ok) {
      throw new WalletServiceError("TRANSACTION_FAILED", "Stellar could not add the USDC trustline. Check that your account has enough XLM for the 0.5 XLM reserve and transaction fee, then retry.");
    }
    const result = await submission.json();
    if (result.successful !== true) {
      throw new WalletServiceError("TRANSACTION_FAILED", "Stellar did not confirm the USDC trustline. Check your wallet activity, then check the trustline again.");
    }
    return "present";
  } catch (error) {
    if (isUserRejection(error) || (error instanceof WalletServiceError && error.code === "SIGNATURE_REJECTED")) return "cancelled";
    if (error instanceof WalletServiceError) throw error;
    throw new WalletServiceError("NETWORK_ERROR", "Could not confirm the USDC trustline. Check your connection and wallet activity, then check the trustline again.");
  }
}

function createRpcServer(): rpc.Server {
  if (!STELLAR_RPC_URL) {
    throw new WalletServiceError(
      "CONFIGURATION",
      "Stellar RPC is not configured for this network.",
    );
  }

  return new rpc.Server(STELLAR_RPC_URL, { timeout: RPC_TIMEOUT_MS });
}

function validateConfiguration(): void {
  if (!STELLAR_VAULT_CONTRACT_ID) {
    throw new WalletServiceError(
      "CONFIGURATION",
      "The Callora vault contract is not configured for this network.",
    );
  }

  if (!STELLAR_RPC_URL) {
    throw new WalletServiceError(
      "CONFIGURATION",
      "Stellar RPC is not configured for this network.",
    );
  }
}

function mapRpcError(error: unknown): WalletServiceError {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("timeout") || message.includes("timed out")) {
    return new WalletServiceError(
      "NETWORK_ERROR",
      "Stellar RPC timed out before the transaction was submitted. No funds were moved; check your connection and retry.",
    );
  }

  return new WalletServiceError(
    "NETWORK_ERROR",
    "Could not reach Stellar RPC before submitting the deposit. No funds were moved; check your connection and retry.",
  );
}

async function waitForConfirmation(
  server: rpc.Server,
  hash: string,
): Promise<void> {
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let transaction;
    try {
      transaction = await server.getTransaction(hash);
    } catch (error) {
      throw new WalletServiceError(
        "NETWORK_TIMEOUT",
        "Could not confirm the submitted transaction. It may still be processing; check Stellar Explorer before retrying.",
        true,
      );
    }

    if (transaction.status === rpc.Api.GetTransactionStatus.SUCCESS) return;
    if (transaction.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new WalletServiceError(
        "TRANSACTION_FAILED",
        "Stellar rejected the deposit transaction. No funds were added to the vault.",
      );
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, Math.min(CONFIRMATION_POLL_INTERVAL_MS, remainingMs)),
    );
  }

  throw new WalletServiceError(
    "NETWORK_TIMEOUT",
    "Network confirmation timed out. The transaction may still be processing; check Stellar Explorer before retrying.",
    true,
  );
}

/**
 * Build, sign, submit, and confirm a Callora Soroban vault deposit.
 * `onSubmitted` receives only the hash returned by Stellar RPC after submission.
 */
export async function submitVaultDeposit(
  amount: string | number,
  onSubmitted?: OnSubmitted,
): Promise<SubmittedDeposit> {
  const amountStroops = toUsdcStroops(amount);
  validateConfiguration();

  validateUsdcConfiguration();
  const address = await getWalletAddress();
  const trustline = await hasUsdcTrustline(address);
  if (trustline === "missing" || trustline === "unfunded-account") {
    throw new WalletServiceError(
      trustline === "missing" ? "TRUSTLINE_MISSING" : "UNFUNDED_ACCOUNT",
      trustline === "missing"
        ? "Add a USDC trustline before depositing."
        : "Fund this Stellar account with XLM before depositing.",
    );
  }
  const server = createRpcServer();
  let sourceAccount;
  try {
    sourceAccount = await server.getAccount(address);
  } catch (error) {
    throw mapRpcError(error);
  }

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(STELLAR_VAULT_CONTRACT_ID).call(
        "deposit",
        new Address(address).toScVal(),
        nativeToScVal(amountStroops, { type: "i128" }),
      ),
    )
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await server.prepareTransaction(transaction);
  } catch (error) {
    throw mapRpcError(error);
  }

  let signature;
  try {
    signature = await signTransaction(preparedTransaction.toXDR(), {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      address,
    });
  } catch (error) {
    throwWalletError(error);
  }
  if (signature.error) throwWalletError(signature.error);
  if (!signature.signedTxXdr || signature.signerAddress !== address) {
    throw new WalletServiceError(
      "WALLET_ERROR",
      "Freighter did not sign the deposit with the connected account.",
    );
  }

  let submission;
  try {
    submission = await server.sendTransaction(
      new Transaction(signature.signedTxXdr, STELLAR_NETWORK_PASSPHRASE),
    );
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase();
    throw new WalletServiceError(
      "NETWORK_TIMEOUT",
      message.includes("timeout") || message.includes("timed out")
        ? "Stellar did not return a submission result. The transaction may still be processing; check your wallet activity before retrying."
        : "The connection failed while submitting. The transaction may still be processing; check your wallet activity before retrying.",
      true,
    );
  }

  if (submission.status === "ERROR" || submission.status === "TRY_AGAIN_LATER") {
    throw new WalletServiceError(
      "TRANSACTION_FAILED",
      "Stellar did not accept the deposit transaction. No funds were added to the vault.",
    );
  }

  if (!submission.hash) {
    throw new WalletServiceError(
      "NETWORK_TIMEOUT",
      "Stellar accepted the request without returning a transaction hash. Check your wallet activity before retrying.",
      true,
    );
  }

  onSubmitted?.(submission.hash);
  await waitForConfirmation(server, submission.hash);

  return { hash: submission.hash };
}
