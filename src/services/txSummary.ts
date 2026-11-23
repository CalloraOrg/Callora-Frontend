import {
  Address,
  Networks,
  Transaction,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

export interface DecodedTransactionArg {
  type: string;
  value: unknown;
}

export interface InvokeTransactionSummary {
  contractId: string;
  functionName: string;
  args: DecodedTransactionArg[];
  amountStroops?: bigint;
  sourceAccount: string;
  feeStroops: bigint;
  network: string;
}

export interface SummarizeInvokeTransactionOptions {
  passphrase: string;
}

function resolveNetworkLabel(passphrase: string): string {
  switch (passphrase) {
    case Networks.PUBLIC:
      return "Mainnet";
    case Networks.TESTNET:
      return "Testnet";
    case Networks.FUTURENET:
      return "Futurenet";
    case Networks.SANDBOX:
      return "Sandbox";
    case Networks.STANDALONE:
      return "Standalone";
    default:
      return passphrase;
  }
}

function decodeFunctionName(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) {
    return new TextDecoder().decode(raw);
  }
  if (raw && typeof raw === "object" && "bytes" in raw && raw.bytes instanceof Uint8Array) {
    return new TextDecoder().decode(raw.bytes);
  }
  return String(raw);
}

function getScValTypeName(scVal: xdr.ScVal): string {
  const anyVal = scVal as unknown as { switch?: () => { name: string }; type?: string };
  if (typeof anyVal.switch === "function") {
    return anyVal.switch().name;
  }
  return anyVal.type ?? "unknown";
}

/**
 * Decode a Stellar Soroban transaction (or base64 XDR) containing a single
 * `invokeHostFunction` contract call into a human-readable summary.
 *
 * Designed to be reusable across deposit, withdraw, and other contract calls.
 */
export function summarizeInvokeTransaction(
  xdrOrTx: string | Transaction,
  options: SummarizeInvokeTransactionOptions,
): InvokeTransactionSummary {
  const tx =
    typeof xdrOrTx === "string"
      ? new Transaction(xdrOrTx, options.passphrase)
      : xdrOrTx;

  if (tx.operations.length !== 1) {
    throw new Error(
      `Expected exactly one operation in transaction, found ${tx.operations.length}.`,
    );
  }

  const operation = tx.operations[0];
  if (operation.type !== "invokeHostFunction") {
    throw new Error(
      `Expected an invokeHostFunction operation, found ${operation.type}.`,
    );
  }

  const rawFunc = operation.func as unknown;
  const hostFunction = (
    typeof rawFunc === "string"
      ? xdr.HostFunction.fromXDR(rawFunc, "base64")
      : rawFunc
  ) as unknown as {
    switch?: () => { name: string };
    type?: string;
    invokeContract?: (() => unknown) | {
      contractAddress: xdr.ScAddress;
      functionName: unknown;
      args: xdr.ScVal[];
    };
  };

  const hostFnType =
    typeof hostFunction.switch === "function"
      ? hostFunction.switch().name
      : hostFunction.type;

  if (hostFnType !== "hostFunctionTypeInvokeContract") {
    throw new Error(
      `Expected an invokeContract host function, found ${String(hostFnType)}.`,
    );
  }

  const invokeArgs = (
    typeof hostFunction.invokeContract === "function"
      ? hostFunction.invokeContract()
      : hostFunction.invokeContract
  ) as {
    contractAddress: (() => xdr.ScAddress) | xdr.ScAddress;
    functionName: (() => unknown) | unknown;
    args: (() => xdr.ScVal[]) | xdr.ScVal[];
  };

  const contractAddress =
    typeof invokeArgs.contractAddress === "function"
      ? invokeArgs.contractAddress()
      : invokeArgs.contractAddress;
  const contractId = Address.fromScAddress(contractAddress).toString();

  const rawFnName =
    typeof invokeArgs.functionName === "function"
      ? invokeArgs.functionName()
      : invokeArgs.functionName;
  const functionName = decodeFunctionName(rawFnName);

  const rawArgs =
    typeof invokeArgs.args === "function"
      ? invokeArgs.args()
      : invokeArgs.args;

  const args: DecodedTransactionArg[] = rawArgs.map((scVal) => ({
    type: getScValTypeName(scVal),
    value: scValToNative(scVal),
  }));

  const i128Arg = args.find(
    (arg) => arg.type === "scvI128" && typeof arg.value === "bigint",
  );
  const amountStroops =
    i128Arg !== undefined ? (i128Arg.value as bigint) : undefined;

  return {
    contractId,
    functionName,
    args,
    ...(amountStroops !== undefined ? { amountStroops } : {}),
    sourceAccount: tx.source,
    feeStroops: BigInt(tx.fee),
    network: resolveNetworkLabel(options.passphrase),
  };
}
