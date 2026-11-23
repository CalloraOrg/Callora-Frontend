import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  StrKey,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  getConfig,
  networkPassphraseFor,
  type RuntimeConfig,
} from "../config/runtimeConfig";

/**
 * Read-only Soroban balance lookups for the Callora vault.
 *
 * Every function here simulates a contract invocation with `send=no` semantics
 * (`rpc.Server.simulateTransaction`): nothing is signed, nothing is submitted,
 * and no ledger state changes. Results are returned as stroops (`i128`, 7
 * decimals) so callers can format them exactly — see `formatUsdcStroops`.
 *
 * The companion hook `src/hooks/useVaultBalances.ts` owns React state, request
 * versioning, and the refresh debounce; this module only performs the reads.
 */

export type VaultReadErrorCode =
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "SIMULATION_FAILED"
  | "BAD_RESPONSE";

export class VaultReadError extends Error {
  readonly code: VaultReadErrorCode;

  constructor(code: VaultReadErrorCode, message: string) {
    super(message);
    this.name = "VaultReadError";
    this.code = code;
  }
}

/**
 * Fixed source account used for simulations when no Freighter address is
 * connected.
 *
 * Soroban RPC validates that the transaction is well formed but never checks
 * sequence numbers, signatures, or account existence for a simulation, so this
 * (valid, deliberately unused) account is safe: it is only ever attached to a
 * read-only invocation that is simulated and discarded, never signed and never
 * submitted. When a wallet address is available it is used instead.
 */
export const SIMULATION_SOURCE_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const RPC_TIMEOUT_MS = 8_000;
const SIMULATION_TIMEOUT_SECONDS = 60;

/** True when a vault contract id and Soroban RPC endpoint are usable. */
export function isVaultReadConfigured(config: RuntimeConfig = getConfig()): boolean {
  return (
    config.vaultContractId !== "" &&
    StrKey.isValidContract(config.vaultContractId) &&
    config.rpcUrl !== ""
  );
}

const rpcServers = new Map<string, rpc.Server>();

function getServer(config: RuntimeConfig): rpc.Server {
  if (!config.rpcUrl) {
    throw new VaultReadError(
      "NOT_CONFIGURED",
      "Stellar RPC is not configured for this network.",
    );
  }
  const key = `${config.network}:${config.rpcUrl}`;
  let server = rpcServers.get(key);
  if (!server) {
    server = new rpc.Server(config.rpcUrl, { timeout: RPC_TIMEOUT_MS });
    rpcServers.set(key, server);
  }
  return server;
}

/** At most one read per key is in flight; concurrent callers share the promise. */
const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = run().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

function resolveSource(sourceAddress?: string): string {
  return sourceAddress && StrKey.isValidEd25519PublicKey(sourceAddress)
    ? sourceAddress
    : SIMULATION_SOURCE_ACCOUNT;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unknown error";
}

async function simulate(
  config: RuntimeConfig,
  contractId: string,
  func: string,
  args: xdr.ScVal[],
  sourceAddress?: string,
): Promise<xdr.ScVal> {
  const transaction = new TransactionBuilder(
    new Account(resolveSource(sourceAddress), "0"),
    {
      fee: BASE_FEE,
      networkPassphrase: networkPassphraseFor(config.network),
    },
  )
    .addOperation(new Contract(contractId).call(func, ...args))
    .setTimeout(SIMULATION_TIMEOUT_SECONDS)
    .build();

  let simulation;
  try {
    simulation = await getServer(config).simulateTransaction(transaction);
  } catch (error) {
    throw new VaultReadError(
      "NETWORK_ERROR",
      `Could not reach Stellar RPC while reading ${func}(): ${describeError(error)}`,
    );
  }

  if (rpc.Api.isSimulationError(simulation)) {
    throw new VaultReadError(
      "SIMULATION_FAILED",
      `Simulating ${func}() failed: ${simulation.error}`,
    );
  }
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new VaultReadError(
      "SIMULATION_FAILED",
      `Simulating ${func}() did not return a result. Check the vault contract id and network.`,
    );
  }
  // In stellar-sdk v12+, the result is in simulation.result.retval
  const simResult = (simulation as any).result;
  if (!simResult?.retval) {
    throw new VaultReadError(
      "BAD_RESPONSE",
      `Simulating ${func}() returned no value.`,
    );
  }
  return simResult.retval;
}

/** Coerce a decoded `i128` into stroops, rejecting anything else. */
function expectStroops(value: unknown, context: string): bigint {
  let stroops: bigint;
  if (typeof value === "bigint") {
    stroops = value;
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    stroops = BigInt(value);
  } else {
    throw new VaultReadError(
      "BAD_RESPONSE",
      `${context} returned an unexpected value; expected an i128 balance.`,
    );
  }
  if (stroops < 0n) {
    throw new VaultReadError(
      "BAD_RESPONSE",
      `${context} returned a negative balance.`,
    );
  }
  return stroops;
}

function notConfiguredError(): VaultReadError {
  return new VaultReadError(
    "NOT_CONFIGURED",
    "The Callora vault contract is not configured for this network, so on-chain balances cannot be read.",
  );
}

/**
 * Simulate the vault's `balance()` entry point.
 *
 * @param sourceAddress Connected Freighter address to attach as the simulation
 *   source; falls back to {@link SIMULATION_SOURCE_ACCOUNT} when unknown.
 * @returns The vault balance in stroops (`i128`).
 */
export async function readVaultBalance(
  sourceAddress?: string,
  config: RuntimeConfig = getConfig(),
): Promise<bigint> {
  if (!isVaultReadConfigured(config)) throw notConfiguredError();
  return dedupe(`vault-balance:${config.network}:${config.rpcUrl}:${config.vaultContractId}`, async () => {
    const retval = await simulate(
      config,
      config.vaultContractId,
      "balance",
      [],
      sourceAddress,
    );
    return expectStroops(scValToNative(retval), "balance()");
  });
}

const usdcTokenAddresses = new Map<string, string>();
const usdcTokenInflight = new Map<string, Promise<string>>();

/** Forget the cached USDC token address and any in-flight read (tests / reset). */
export function resetVaultReadCaches(): void {
  usdcTokenAddresses.clear();
  usdcTokenInflight.clear();
  rpcServers.clear();
  inflight.clear();
}

/**
 * Simulate the vault's `get_usdc_token()` entry point and cache the result for
 * the lifetime of the session.
 *
 * @returns The Stellar Asset Contract address backing the vault's USDC.
 */
export async function readUsdcToken(
  sourceAddress?: string,
  config: RuntimeConfig = getConfig(),
): Promise<string> {
  if (!isVaultReadConfigured(config)) throw notConfiguredError();
  const cacheKey = `${config.network}:${config.rpcUrl}:${config.vaultContractId}`;
  const cachedAddress = usdcTokenAddresses.get(cacheKey);
  if (cachedAddress) return cachedAddress;
  const pendingRequest = usdcTokenInflight.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const retval = await simulate(
      config,
      config.vaultContractId,
      "get_usdc_token",
      [],
      sourceAddress,
    );
    const token = scValToNative(retval);
    if (typeof token !== "string" || !StrKey.isValidContract(token)) {
      throw new VaultReadError(
        "BAD_RESPONSE",
        "get_usdc_token() did not return a Stellar Asset Contract address.",
      );
    }
    return token;
  })();

  usdcTokenInflight.set(cacheKey, request);
  try {
    const token = await request;
    usdcTokenAddresses.set(cacheKey, token);
    return token;
  } finally {
    if (usdcTokenInflight.get(cacheKey) === request) {
      usdcTokenInflight.delete(cacheKey);
    }
  }
}

/**
 * Simulate `balance(address)` on the vault's USDC Stellar Asset Contract.
 *
 * @param address Account whose USDC balance is read; also used as the
 *   simulation source.
 * @returns The wallet's USDC balance in stroops.
 */
export async function readWalletUsdcBalance(
  address: string,
  config: RuntimeConfig = getConfig(),
): Promise<bigint> {
  if (!isVaultReadConfigured(config)) throw notConfiguredError();
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new VaultReadError(
      "BAD_RESPONSE",
      "A valid Stellar account address is required to read a wallet USDC balance.",
    );
  }
  const token = await readUsdcToken(address, config);
  return dedupe(`wallet-balance:${config.network}:${config.rpcUrl}:${token}:${address}`, async () => {
    const retval = await simulate(
      config,
      token,
      "balance",
      [new Address(address).toScVal()],
      address,
    );
    return expectStroops(scValToNative(retval), "USDC balance()");
  });
}

export type VaultDepositPreflight = {
  paused: boolean;
  allowlisted: boolean;
};

/**
 * Simulate the vault's `is_paused()` and `is_authorized_depositor(address)`
 * entry points, so the UI can explain why a deposit would fail before the
 * wallet is asked to sign. Read-only: nothing is signed or submitted.
 */
export async function readVaultDepositPreflight(
  address: string,
  config: RuntimeConfig = getConfig(),
): Promise<VaultDepositPreflight> {
  if (!isVaultReadConfigured(config)) throw notConfiguredError();
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new VaultReadError(
      "BAD_RESPONSE",
      "A valid Stellar account address is required to check vault deposits.",
    );
  }
  return dedupe(`deposit-preflight:${config.network}:${config.rpcUrl}:${config.vaultContractId}:${address}`, async () => {
    const [pausedVal, allowlistedVal] = await Promise.all([
      simulate(config, config.vaultContractId, "is_paused", [], address),
      simulate(
        config,
        config.vaultContractId,
        "is_authorized_depositor",
        [new Address(address).toScVal()],
        address,
      ),
    ]);
    const paused = scValToNative(pausedVal);
    const allowlisted = scValToNative(allowlistedVal);
    if (typeof paused !== "boolean" || typeof allowlisted !== "boolean") {
      throw new VaultReadError(
        "BAD_RESPONSE",
        "Vault deposit preflight did not return booleans.",
      );
    }
    return { paused, allowlisted };
  });
}
