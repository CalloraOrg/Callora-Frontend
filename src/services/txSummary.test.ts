// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { summarizeInvokeTransaction } from "./txSummary";

const SOURCE_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const VAULT_CONTRACT_ID = "CBJZLUKQBWDMZPKNJAVONZ7GCCWADSETRXWOPN5Z3XWAUNI4F2R7XDYQ";
const OTHER_CONTRACT_ID = "CAC7CFZ42L3LTTZCI4C3XI6UF7AHS2PYTNJ5QEG2PSLRGDGMWRQOZOT5";
const PASSPHRASE = Networks.TESTNET;

function buildDepositTx(options?: {
  contractId?: string;
  fn?: string;
  depositor?: string;
  amountStroops?: bigint;
  fee?: string;
  extraOp?: boolean;
}) {
  const {
    contractId = VAULT_CONTRACT_ID,
    fn = "deposit",
    depositor = SOURCE_ACCOUNT,
    amountStroops = 500_000_000n, // 50 USDC
    fee = "12345",
    extraOp = false,
  } = options ?? {};

  const builder = new TransactionBuilder(new Account(SOURCE_ACCOUNT, "100"), {
    fee,
    networkPassphrase: PASSPHRASE,
  }).addOperation(
    new Contract(contractId).call(
      fn,
      new Address(depositor).toScVal(),
      nativeToScVal(amountStroops, { type: "i128" }),
    ),
  );

  if (extraOp) {
    builder.addOperation(
      Operation.payment({
        destination: SOURCE_ACCOUNT,
        asset: Asset.native(),
        amount: "1",
      }),
    );
  }

  return builder.setTimeout(120).build();
}

describe("summarizeInvokeTransaction", () => {
  it("decodes a valid deposit transaction from XDR and Transaction instance", () => {
    const tx = buildDepositTx({ amountStroops: 123_456_789n, fee: "25000" });

    for (const input of [tx.toXDR(), tx]) {
      const summary = summarizeInvokeTransaction(input, { passphrase: PASSPHRASE });
      expect(summary).toEqual({
        contractId: VAULT_CONTRACT_ID,
        functionName: "deposit",
        args: [
          { type: "scvAddress", value: SOURCE_ACCOUNT },
          { type: "scvI128", value: 123_456_789n },
        ],
        amountStroops: 123_456_789n,
        sourceAccount: SOURCE_ACCOUNT,
        feeStroops: 25000n,
        network: "Testnet",
      });
    }
  });

  it("decodes a different contract id accurately", () => {
    const tx = buildDepositTx({ contractId: OTHER_CONTRACT_ID });
    const summary = summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE });
    expect(summary.contractId).toBe(OTHER_CONTRACT_ID);
  });

  it("decodes a different amount accurately", () => {
    const tx = buildDepositTx({ amountStroops: 999_000_000n });
    const summary = summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE });
    expect(summary.amountStroops).toBe(999_000_000n);
  });

  it("throws when the transaction has two operations", () => {
    const tx = buildDepositTx({ extraOp: true });
    expect(() =>
      summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE }),
    ).toThrow(/exactly one operation/i);
  });

  it("throws when the operation is not invokeHostFunction", () => {
    const tx = new TransactionBuilder(new Account(SOURCE_ACCOUNT, "100"), {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: SOURCE_ACCOUNT,
          asset: Asset.native(),
          amount: "10",
        }),
      )
      .setTimeout(120)
      .build();

    expect(() =>
      summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE }),
    ).toThrow(/invokeHostFunction/i);
  });

  it("handles very large i128 amounts without precision loss", () => {
    // Larger than Number.MAX_SAFE_INTEGER (9_007_199_254_740_991)
    const hugeAmount = 123_456_789_012_345_678_901_234_567n;
    const tx = buildDepositTx({ amountStroops: hugeAmount });
    const summary = summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE });
    expect(summary.amountStroops).toBe(hugeAmount);
    expect(summary.args[1].value).toBe(hugeAmount);
  });

  it("handles amounts with 7 decimal places accurately", () => {
    const sevenDecimals = 10_000_001n; // 1.0000001 USDC
    const tx = buildDepositTx({ amountStroops: sevenDecimals });
    const summary = summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE });
    expect(summary.amountStroops).toBe(sevenDecimals);
  });

  it("succeeds even when the Soroban data extension is missing", () => {
    // TransactionBuilder without rpc.assembleTransaction produces a tx with no Soroban data extension
    const tx = buildDepositTx();
    const summary = summarizeInvokeTransaction(tx.toXDR(), { passphrase: PASSPHRASE });
    expect(summary.contractId).toBe(VAULT_CONTRACT_ID);
    expect(summary.functionName).toBe("deposit");
  });
});
