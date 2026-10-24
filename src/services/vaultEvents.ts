import {
  Address,
  StrKey,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  STELLAR_NETWORK_LABEL,
  STELLAR_RPC_URL,
  STELLAR_USDC_DECIMALS,
  STELLAR_VAULT_CONTRACT_ID,
} from "../config/constants";
import type { BillingTransaction } from "../pages/BillingHistory";

/**
 * Reads a wallet's vault deposit history from the vault's `deposit` events.
 *
 * The vault emits `(Symbol("deposit"), version, caller)` as topics and
 * `(amount, new_balance)` as data. Events are read with Soroban RPC
 * `getEvents`, filtered to the connected address. Nothing is signed, and
 * nothing is written to the ledger.
 */

const RPC_TIMEOUT_MS = 8_000;
/** About seven days of ledgers at 5 seconds each, the usual RPC retention. */
const LOOKBACK_LEDGERS = 120_960;
export const DEPOSIT_PAGE_SIZE = 25;

export type DepositHistoryPage = {
  transactions: BillingTransaction[];
  /** Cursor for the next page, or null when the page was the last one. */
  nextCursor: string | null;
  /** True when the requested history starts before the RPC retention window. */
  retentionTruncated: boolean;
};

export class DepositHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DepositHistoryError";
  }
}

let rpcServer: rpc.Server | null = null;

function getServer(): rpc.Server {
  if (!STELLAR_RPC_URL) {
    throw new DepositHistoryError("Stellar RPC is not configured for this network.");
  }
  if (!rpcServer) {
    rpcServer = new rpc.Server(STELLAR_RPC_URL, { timeout: RPC_TIMEOUT_MS });
  }
  return rpcServer;
}

/** Decode the `(amount, new_balance)` data of a deposit event, or null if it has another shape. */
function decodeDepositAmount(value: xdr.ScVal): bigint | null {
  const native = scValToNative(value);
  if (!Array.isArray(native) || typeof native[0] !== "bigint") return null;
  return native[0];
}

function formatStroopsAsUsdc(stroops: bigint): number {
  // USDC has 7 decimals; the page works in JS numbers, so amounts above
  // Number.MAX_SAFE_INTEGER stroops would lose precision here.
  return Number(stroops) / 10 ** STELLAR_USDC_DECIMALS;
}

/**
 * Fetch one page of deposit events for `address`, newest first.
 *
 * @param cursor Pass the `nextCursor` from the previous page to continue.
 * @param signal Aborts the request when the page or wallet changes.
 */
export async function fetchDepositEvents(args: {
  address: string;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<DepositHistoryPage> {
  const { address, cursor, signal } = args;
  if (!STELLAR_VAULT_CONTRACT_ID || !StrKey.isValidContract(STELLAR_VAULT_CONTRACT_ID)) {
    throw new DepositHistoryError("The Callora vault contract is not configured for this network.");
  }
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new DepositHistoryError("A valid Stellar account address is required to load deposits.");
  }

  const server = getServer();
  const topics = [[
    xdr.ScVal.scvSymbol("deposit").toXDR("base64"),
    "*",
    new Address(address).toScVal().toXDR("base64"),
  ]];
  const filters = [{ type: "contract" as const, contractIds: [STELLAR_VAULT_CONTRACT_ID], topics }];

  let retentionTruncated = false;
  let request: Parameters<rpc.Server["getEvents"]>[0];
  try {
    if (cursor) {
      request = { filters, limit: DEPOSIT_PAGE_SIZE, cursor };
    } else {
      const health = await server.getHealth();
      const earliestWanted = health.latestLedger - LOOKBACK_LEDGERS;
      retentionTruncated = earliestWanted < health.oldestLedger;
      request = {
        filters,
        limit: DEPOSIT_PAGE_SIZE,
        startLedger: Math.max(health.oldestLedger, earliestWanted),
      };
    }
    const response = await server.getEvents(request);
    if (signal?.aborted) throw new DepositHistoryError("Request cancelled.");

    const latestLedger = response.latestLedger;
    const transactions: BillingTransaction[] = [];
    for (const event of response.events) {
      if (!event.inSuccessfulContractCall) continue;
      const stroops = decodeDepositAmount(event.value);
      if (stroops === null) continue;
      transactions.push({
        id: event.id,
        description: "USDC vault deposit",
        type: "Deposit",
        direction: "credit",
        amount: formatStroopsAsUsdc(stroops),
        status: "success",
        timestamp: event.ledgerClosedAt,
        txHash: event.txHash,
        network: STELLAR_NETWORK_LABEL,
        confirmations: Math.max(0, latestLedger - event.ledger),
      });
    }

    return {
      transactions,
      nextCursor: response.events.length >= DEPOSIT_PAGE_SIZE ? response.cursor : null,
      retentionTruncated,
    };
  } catch (error) {
    if (error instanceof DepositHistoryError) throw error;
    throw new DepositHistoryError("Could not load deposit history from Stellar RPC. Try again.");
  }
}
