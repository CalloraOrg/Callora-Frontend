import {
  PENDING_DEPOSIT_STORAGE_KEY,
  type StellarNetwork,
} from "../config/constants";
import { StrKey } from "@stellar/stellar-sdk";
import { getConfig } from "../config/runtimeConfig";

export type DepositStage = "input" | "approving" | "pending" | "confirmed" | "failed";

export interface PendingDepositRecord {
  hash: string;
  amount: number;
  submittedAt: number;
  network: StellarNetwork;
  contractId: string;
  rpcUrl?: string;
}

export function readPendingDeposit(): PendingDepositRecord | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DEPOSIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.hash === "string" &&
      typeof parsed.amount === "number" &&
      typeof parsed.submittedAt === "number" &&
      ["testnet", "mainnet", "futurenet"].includes(parsed.network) &&
      typeof parsed.contractId === "string" &&
      StrKey.isValidContract(parsed.contractId)
    ) {
      let rpcUrl = parsed.rpcUrl;
      if (typeof rpcUrl === "string") {
        const endpoint = new URL(rpcUrl);
        if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) return null;
      } else if (
        parsed.network === getConfig().network &&
        parsed.contractId === getConfig().vaultContractId
      ) {
        rpcUrl = getConfig().rpcUrl;
      } else {
        return null;
      }
      if (!rpcUrl) return null;
      return { ...parsed, rpcUrl } as PendingDepositRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function writePendingDeposit(record: PendingDepositRecord): void {
  try {
    sessionStorage.setItem(PENDING_DEPOSIT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Gracefully handle storage quota or private mode restrictions
  }
}

export function clearPendingDeposit(): void {
  try {
    sessionStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
  } catch {
    // Gracefully handle storage restrictions
  }
}

export const STAGE_LABELS: Record<DepositStage, string> = {
  input: "Enter Amount",
  approving: "Approving",
  pending: "Pending",
  confirmed: "Confirmed",
  failed: "Failed",
};

export function buildExplorerLink(hash: string, network: StellarNetwork = getConfig().network): string {
  const explorerNetwork = network === "mainnet" ? "public" : network;
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${hash}`;
}

export function getStageLabel(stage: DepositStage, hasValidAmount: boolean): string {
  if (stage === "approving") return "Approve in wallet...";
  if (stage === "pending") return "Transaction submitted...";
  if (stage === "confirmed") return "Deposit successful";
  if (stage === "failed") return "Transaction failed";

  return hasValidAmount ? "Review transaction preview" : "Enter a deposit amount";
}
