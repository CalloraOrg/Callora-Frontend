// @vitest-environment node
import { describe, expect, it } from "vitest";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { decodeVaultError } from "./vaultErrors";

function diagnostic(value: xdr.ScVal): xdr.DiagnosticEvent {
  return new xdr.DiagnosticEvent({
    inSuccessfulContractCall: false,
    event: new xdr.ContractEvent({
      ext: xdr.ExtensionPoint.v0(), contractId: null,
      type: xdr.ContractEventType.diagnostic,
      body: xdr.ContractEventBody.v0(new xdr.ContractEventV0({ topics: [value], data: nativeToScVal("private diagnostic") })),
    }),
  });
}

describe("decodeVaultError", () => {
  it.each([
    [1, "not initialized"], [4, "paused"], [6, "greater than zero"],
    [8, "below the vault minimum"], [9, "smaller deposit"], [36, "rate limit"],
    [37, "paused"], [44, "allowlist"], [99, "code 99"],
  ])("maps contract code %s without exposing host diagnostics", (code, text) => {
    const decoded = decodeVaultError({ error: `HostError: Error(Contract, #${code}) XDR secret-address` });
    expect(decoded.code).toBe(code);
    expect(decoded.message).toContain(text);
    expect(decoded.message).not.toMatch(/HostError|XDR|secret-address/);
  });
  it("decodes a structured contract error in a real SDK diagnostic event", () => {
    expect(decodeVaultError({ error: "simulation failed", events: [diagnostic(xdr.ScVal.scvError(xdr.ScError.sceContract(44)))] }))
      .toEqual({ code: 44, message: "This wallet is not on the vault's deposit allowlist." });
  });
  it("ignores malformed/non-contract events and searches later diagnostics", () => {
    const events = [null as unknown as xdr.DiagnosticEvent, diagnostic(nativeToScVal(false)), diagnostic(nativeToScVal("Error(Contract, #8)"))];
    expect(decodeVaultError({ events }).code).toBe(8);
  });
  it("does not mistake system error numbers or arbitrary text for contract codes", () => {
    expect(decodeVaultError({ error: "HostError: Error(Storage, #44)", events: [diagnostic(nativeToScVal(44))] }))
      .toEqual({ message: "The vault could not simulate this deposit. No funds were moved." });
    expect(decodeVaultError({}).code).toBeUndefined();
  });
});
