import { describe, expect, it } from "vitest";
import { resolveVaultConfig } from "./vaultConfig";

const TESTNET_VAULT = "CBJZLUKQBWDMZPKNJAVONZ7GCCWADSETRXWOPN5Z3XWAUNI4F2R7XDYQ";
const OTHER_VAULT = "CB4BUGCX5LFS5KYWAO2J4ZQTALOQSGXFFAOVKKGAS32OFZLU7O7YYGHS";
const ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("resolveVaultConfig", () => {
  it("defaults testnet to the reference vault when the env var is empty", () => {
    expect(resolveVaultConfig({ network: "testnet", envContractId: "", testnetDefault: TESTNET_VAULT }))
      .toEqual({ contractId: TESTNET_VAULT, source: "testnet-default" });
  });

  it("reports a missing vault on mainnet when the env var is empty", () => {
    const config = resolveVaultConfig({ network: "mainnet", envContractId: "", testnetDefault: TESTNET_VAULT });
    expect(config.contractId).toBe("");
    expect(config.source).toBe("missing");
    expect(config.error).toMatch(/not configured/);
  });

  it("prefers a valid env value over the testnet default", () => {
    expect(resolveVaultConfig({ network: "testnet", envContractId: ` ${OTHER_VAULT} `, testnetDefault: TESTNET_VAULT }))
      .toEqual({ contractId: OTHER_VAULT, source: "env" });
  });

  it("rejects an account address used in place of a contract ID", () => {
    const config = resolveVaultConfig({ network: "testnet", envContractId: ACCOUNT, testnetDefault: TESTNET_VAULT });
    expect(config.contractId).toBe("");
    expect(config.error).toMatch(/not a valid contract address/);
  });
});
