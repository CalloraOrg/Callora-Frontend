import { StrKey } from "@stellar/stellar-sdk";

export type VaultConfigSource = "env" | "testnet-default" | "missing";

export type VaultConfig = {
  /** Contract ID deposits are sent to; empty when the config is unusable. */
  contractId: string;
  source: VaultConfigSource;
  /** User-facing reason deposits are blocked; absent when the config is usable. */
  error?: string;
};

/**
 * Resolve the vault contract ID for a network. `testnet` falls back to the
 * reference testnet vault when the env var is empty; other networks have no
 * default and must set the variable. Pure, so it can be tested without env.
 */
export function resolveVaultConfig(env: {
  network: string;
  envContractId?: string;
  testnetDefault: string;
}): VaultConfig {
  const fromEnv = (env.envContractId ?? "").trim();
  let contractId = fromEnv;
  let source: VaultConfigSource = "env";

  if (!contractId && env.network === "testnet") {
    contractId = env.testnetDefault;
    source = "testnet-default";
  }

  if (!contractId) {
    return {
      contractId: "",
      source: "missing",
      error: "The Callora vault contract is not configured for this network.",
    };
  }

  if (!StrKey.isValidContract(contractId)) {
    return {
      contractId: "",
      source,
      error: "The configured Callora vault contract ID is not a valid contract address.",
    };
  }

  return { contractId, source };
}
