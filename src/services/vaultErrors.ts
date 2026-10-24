import { humanizeEvents, type xdr } from "@stellar/stellar-sdk";

const MESSAGES: Record<number, string> = {
  1: "The vault is not initialized. Contact the vault operator.",
  4: "Deposits are paused on the vault right now.",
  6: "Deposit amount must be greater than zero.",
  8: "Amount is below the vault minimum.",
  9: "The vault cannot accept this amount. Try a smaller deposit.",
  36: "The vault deposit rate limit was reached. Wait before retrying.",
  37: "Deposits are paused on the vault right now.",
  44: "This wallet is not on the vault's deposit allowlist.",
};

function contractCode(value: unknown): number | undefined {
  if (typeof value === "string") {
    const match = /Error\(Contract,\s*#(\d+)\)/.exec(value);
    if (match) return Number(match[1]);
  }
  if (value && typeof value === "object") {
    if ("type" in value && value.type === "contract" && "code" in value &&
        typeof value.code === "number" && Number.isInteger(value.code) && value.code >= 0) {
      return value.code;
    }
    for (const child of Object.values(value)) {
      const code = contractCode(child);
      if (code !== undefined) return code;
    }
  }
  return undefined;
}

/** Decode only contract error codes; raw host errors/XDR never become UI text. */
export function decodeVaultError(simulation: { error?: string; events?: xdr.DiagnosticEvent[] }): {
  code?: number;
  message: string;
} {
  let code = contractCode(simulation.error);
  if (code === undefined) {
    for (const event of simulation.events ?? []) {
      try {
        code = contractCode(humanizeEvents([event]));
        if (code !== undefined) break;
      } catch {
        // A malformed diagnostic must not hide the original simulation failure.
      }
    }
  }
  return {
    ...(code === undefined ? {} : { code }),
    message: code === undefined ? "The vault could not simulate this deposit. No funds were moved."
      : MESSAGES[code] ?? `The vault rejected this deposit (code ${code}).`,
  };
}
