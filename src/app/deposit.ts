import {
  EXPLORER_BASE_URL,
  PENDING_DEPOSIT_STORAGE_KEY,
  STELLAR_NETWORK,
  STELLAR_VAULT_CONTRACT_ID,
  type StellarNetwork,
} from "../config/constants";

export type DepositStage = "input" | "approving" | "pending" | "confirmed" | "failed";

export interface PendingDepositRecord {
  hash: string;
  amount: number;
  submittedAt: number;
  network: StellarNetwork;
  contractId: string;
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
      parsed.network === STELLAR_NETWORK &&
      parsed.contractId === STELLAR_VAULT_CONTRACT_ID
    ) {
      return parsed as PendingDepositRecord;
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

export function buildExplorerLink(hash: string): string {
  return `${EXPLORER_BASE_URL}${hash}`;
}

export function getStageLabel(stage: DepositStage, hasValidAmount: boolean): string {
  if (stage === "approving") return "Approve in wallet...";
  if (stage === "pending") return "Transaction submitted...";
  if (stage === "confirmed") return "Deposit successful";
  if (stage === "failed") return "Transaction failed";

  return hasValidAmount ? "Review transaction preview" : "Enter a deposit amount";
}
