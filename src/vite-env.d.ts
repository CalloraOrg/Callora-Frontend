/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: "testnet" | "mainnet";
  readonly VITE_STELLAR_RPC_URL?: string;
  readonly VITE_STELLAR_VAULT_CONTRACT_ID?: string;
  readonly VITE_ENABLE_DEMO_OUTCOME?: string;
}
