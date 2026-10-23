// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getEvents: vi.fn(),
}));

vi.mock("../config/constants", async (importOriginal) => ({
  ...await importOriginal<typeof import("../config/constants")>(),
  STELLAR_NETWORK_LABEL: "Stellar Testnet",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_VAULT_CONTRACT_ID: "CBJZLUKQBWDMZPKNJAVONZ7GCCWADSETRXWOPN5Z3XWAUNI4F2R7XDYQ",
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: class {
        getHealth = mocks.getHealth;
        getEvents = mocks.getEvents;
      },
    },
  };
});

import { DEPOSIT_PAGE_SIZE, fetchDepositEvents } from "./vaultEvents";
import { SIMULATION_SOURCE_ACCOUNT as WALLET } from "./vaultReads";
import { STELLAR_VAULT_CONTRACT_ID } from "../config/constants";

const TX_HASH = "a".repeat(64);

function depositEvent(id: string, ledger: number, stroops: bigint, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "contract",
    ledger,
    ledgerClosedAt: "2026-10-20T10:00:00Z",
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: TX_HASH,
    topic: [],
    value: xdr.ScVal.scvVec([
      nativeToScVal(stroops, { type: "i128" }),
      nativeToScVal(0n, { type: "i128" }),
    ]),
    ...overrides,
  };
}

describe("fetchDepositEvents", () => {
  beforeEach(() => {
    mocks.getHealth.mockReset().mockResolvedValue({ latestLedger: 500_000, oldestLedger: 450_000 });
    mocks.getEvents.mockReset().mockResolvedValue({ events: [], latestLedger: 500_000, oldestLedger: 450_000, cursor: "" });
  });

  it("maps deposit events to billing rows with exact amounts and confirmations", async () => {
    mocks.getEvents.mockResolvedValueOnce({
      events: [depositEvent("evt-1", 499_990, 100_000_000n)],
      latestLedger: 500_000,
      oldestLedger: 450_000,
      cursor: "c",
    });
    const page = await fetchDepositEvents({ address: WALLET });
    expect(page.transactions).toEqual([{
      id: "evt-1",
      description: "USDC vault deposit",
      type: "Deposit",
      direction: "credit",
      amount: 10,
      status: "success",
      timestamp: "2026-10-20T10:00:00Z",
      txHash: TX_HASH,
      network: "Stellar Testnet",
      confirmations: 10,
    }]);
  });

  it("filters to the vault contract, the deposit topic and the connected address", async () => {
    await fetchDepositEvents({ address: WALLET });
    const request = mocks.getEvents.mock.calls[0][0];
    const [filter] = request.filters;
    expect(filter.type).toBe("contract");
    expect(filter.contractIds).toEqual([STELLAR_VAULT_CONTRACT_ID]);
    expect(filter.topics[0][0]).toBe(xdr.ScVal.scvSymbol("deposit").toXDR("base64"));
    expect(filter.topics[0][2]).toBe(new Address(WALLET).toScVal().toXDR("base64"));
    expect(request.limit).toBe(DEPOSIT_PAGE_SIZE);
  });

  it("starts at the RPC's oldest ledger and flags history that falls outside retention", async () => {
    mocks.getHealth.mockResolvedValueOnce({ latestLedger: 500_000, oldestLedger: 300_000 });
    const page = await fetchDepositEvents({ address: WALLET });
    expect(mocks.getEvents.mock.calls[0][0].startLedger).toBe(500_000 - 120_960);
    expect(page.retentionTruncated).toBe(false);

    mocks.getHealth.mockResolvedValueOnce({ latestLedger: 500_000, oldestLedger: 450_000 });
    const truncated = await fetchDepositEvents({ address: WALLET });
    expect(truncated.retentionTruncated).toBe(true);
  });

  it("returns a cursor only when the page is full, and continues with it", async () => {
    const full = Array.from({ length: DEPOSIT_PAGE_SIZE }, (_, i) => depositEvent(`evt-${i}`, 499_000 + i, 1_000_000n));
    mocks.getEvents.mockResolvedValueOnce({ events: full, latestLedger: 500_000, oldestLedger: 450_000, cursor: "next" });
    const first = await fetchDepositEvents({ address: WALLET });
    expect(first.nextCursor).toBe("next");

    mocks.getEvents.mockResolvedValueOnce({ events: [], latestLedger: 500_000, oldestLedger: 450_000, cursor: "" });
    const second = await fetchDepositEvents({ address: WALLET, cursor: first.nextCursor });
    expect(second.nextCursor).toBeNull();
    expect(mocks.getEvents.mock.calls[1][0]).toEqual(expect.objectContaining({ cursor: "next" }));
  });

  it("skips failed calls and events whose data is not an amount", async () => {
    mocks.getEvents.mockResolvedValueOnce({
      events: [
        depositEvent("failed", 499_999, 1n, { inSuccessfulContractCall: false }),
        depositEvent("odd", 499_999, 1n, { value: xdr.ScVal.scvString("not an amount") }),
        depositEvent("ok", 499_999, 5_000_000n),
      ],
      latestLedger: 500_000,
      oldestLedger: 450_000,
      cursor: "",
    });
    const page = await fetchDepositEvents({ address: WALLET });
    expect(page.transactions.map((tx) => tx.id)).toEqual(["ok"]);
  });

  it("rejects a non-account address before calling RPC", async () => {
    await expect(fetchDepositEvents({ address: STELLAR_VAULT_CONTRACT_ID })).rejects.toThrow(/valid Stellar account/);
    expect(mocks.getEvents).not.toHaveBeenCalled();
  });

  it("reports RPC failures with a user-facing message and no raw detail", async () => {
    mocks.getEvents.mockRejectedValueOnce(new Error("HostError: secret detail"));
    await expect(fetchDepositEvents({ address: WALLET })).rejects.toThrow("Could not load deposit history from Stellar RPC. Try again.");
  });
});
