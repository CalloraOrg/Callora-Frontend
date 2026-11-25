import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import { isValidContractId, isValidEd25519PublicKey } from "./stellarAddress";

const VALID_PUBLIC_KEYS = [
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ",
];

const VALID_CONTRACT_IDS = [
  "CBJZLUKQBWDMZPKNJAVONZ7GCCWADSETRXWOPN5Z3XWAUNI4F2R7XDYQ",
  "CB4BUGCX5LFS5KYWAO2J4ZQTALOQSGXFFAOVKKGAS32OFZLU7O7YYGHS",
  "CC5KINWRSLKSSQG4ZOTP3EZIOUVC6ER7HL5GZALYY4LVE6ZIMX4PMCSE",
];

// Valid muxed account (M...) and secret seed (S...) for cross-type rejection checks
const VALID_MUXED_ADDRESS =
  "MAAAAAAAAAAAJURAAB2X52XFQP6FBXLGT6LWOOWMEXWHEWBDVRZ7V5WH34Y22MPFBHUHY";
const VALID_SECRET_SEED =
  "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function flipLastChar(value: string): string {
  const last = value.slice(-1);
  return value.slice(0, -1) + (last === "A" ? "B" : "A");
}

function flipMiddleChar(value: string): string {
  const mid = Math.floor(value.length / 2);
  const ch = value[mid];
  return value.slice(0, mid) + (ch === "A" ? "B" : "A") + value.slice(mid + 1);
}

describe("stellarAddress validators", () => {
  const allCases = [
    ...VALID_PUBLIC_KEYS,
    ...VALID_CONTRACT_IDS,
    VALID_MUXED_ADDRESS,
    VALID_SECRET_SEED,
    "",
    "   ",
    VALID_PUBLIC_KEYS[0]!.toLowerCase(),
    VALID_CONTRACT_IDS[0]!.toLowerCase(),
    VALID_PUBLIC_KEYS[0]!.slice(0, 55),
    `${VALID_PUBLIC_KEYS[0]!}A`,
    VALID_CONTRACT_IDS[0]!.slice(0, 55),
    `${VALID_CONTRACT_IDS[0]!}A`,
    flipLastChar(VALID_PUBLIC_KEYS[0]!),
    flipMiddleChar(VALID_PUBLIC_KEYS[0]!),
    flipLastChar(VALID_CONTRACT_IDS[0]!),
    flipMiddleChar(VALID_CONTRACT_IDS[0]!),
    ` ${VALID_PUBLIC_KEYS[0]!} `,
    ` ${VALID_CONTRACT_IDS[0]!} `,
    "G" + "0".repeat(55),
    "C" + "1".repeat(55),
    "G" + "8".repeat(55),
    "C" + "9".repeat(55),
    "G" + "=".repeat(55),
    "G" + "é".repeat(55),
  ];

  it("matches StrKey.isValidEd25519PublicKey across valid and invalid inputs", () => {
    for (const candidate of allCases) {
      expect(isValidEd25519PublicKey(candidate), `public key: ${candidate}`).toBe(
        StrKey.isValidEd25519PublicKey(candidate),
      );
    }
  });

  it("matches StrKey.isValidContract across valid and invalid inputs", () => {
    for (const candidate of allCases) {
      expect(isValidContractId(candidate), `contract id: ${candidate}`).toBe(
        StrKey.isValidContract(candidate),
      );
    }
  });

  it("accepts known-good public keys and rejects non-public-keys", () => {
    for (const key of VALID_PUBLIC_KEYS) {
      expect(isValidEd25519PublicKey(key)).toBe(true);
      expect(isValidContractId(key)).toBe(false);
    }
    expect(isValidEd25519PublicKey(VALID_MUXED_ADDRESS)).toBe(false);
    expect(isValidEd25519PublicKey(VALID_SECRET_SEED)).toBe(false);
    expect(isValidEd25519PublicKey("")).toBe(false);
  });

  it("accepts known-good contract IDs and rejects non-contracts", () => {
    for (const contractId of VALID_CONTRACT_IDS) {
      expect(isValidContractId(contractId)).toBe(true);
      expect(isValidEd25519PublicKey(contractId)).toBe(false);
    }
    expect(isValidContractId(VALID_MUXED_ADDRESS)).toBe(false);
    expect(isValidContractId(VALID_SECRET_SEED)).toBe(false);
    expect(isValidContractId("")).toBe(false);
  });
});

describe("entry bundle does not eagerly import @stellar/stellar-sdk", () => {
  const STATIC_SDK_IMPORT = /^\s*import\s+(?!type\b)[\s\S]*?from\s+["']@stellar\/stellar-sdk["']/m;

  const entryModules = [
    "src/config/constants.ts",
    "src/services/vaultConfig.ts",
    "src/config/runtimeConfig.ts",
    "src/app/deposit.ts",
    "src/hooks/useVaultBalances.ts",
    "src/hooks/useDepositHistory.ts",
  ];

  it.each(entryModules)("%s does not statically import @stellar/stellar-sdk", (relPath) => {
    const source = readFileSync(resolve(process.cwd(), relPath), "utf8");
    expect(source).not.toMatch(STATIC_SDK_IMPORT);
  });

  it("hooks load vaultReads and vaultEvents dynamically instead of statically", () => {
    const vaultBalancesSource = readFileSync(
      resolve(process.cwd(), "src/hooks/useVaultBalances.ts"),
      "utf8",
    );
    expect(vaultBalancesSource).not.toMatch(
      /^\s*import\s+(?!type\b)[\s\S]*?from\s+["']\.\.\/services\/vaultReads["']/m,
    );

    const depositHistorySource = readFileSync(
      resolve(process.cwd(), "src/hooks/useDepositHistory.ts"),
      "utf8",
    );
    expect(depositHistorySource).not.toMatch(
      /^\s*import\s+(?!type\b)[\s\S]*?from\s+["']\.\.\/services\/vaultEvents["']/m,
    );
  });
});
