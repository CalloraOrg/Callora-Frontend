/**
 * Lightweight Stellar StrKey (SEP-0023) address validators implemented without
 * `@stellar/stellar-sdk` so entry-bundle modules can validate public keys and
 * contract IDs without pulling the full SDK into the initial chunk.
 */

const STRKEY_LENGTH = 56;
const DECODED_LENGTH = 35; // 1 version byte + 32 payload bytes + 2 CRC16 bytes

const VERSION_BYTE_ED25519_PUBLIC_KEY = 6 << 3; // 0x30 ('G')
const VERSION_BYTE_CONTRACT = 2 << 3; // 0x10 ('C')

// RFC 4648 base32 lookup table (uppercase A-Z, 2-7 only).
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_LOOKUP = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE32_ALPHABET.length; i += 1) {
  BASE32_LOOKUP[BASE32_ALPHABET.charCodeAt(i)] = i;
}

function decodeBase32StrKey(input: string): Uint8Array | null {
  if (typeof input !== "string" || input.length !== STRKEY_LENGTH) {
    return null;
  }

  const out = new Uint8Array(DECODED_LENGTH);
  let outIndex = 0;

  // 56 base32 chars = 7 blocks of 8 chars -> 7 blocks of 5 bytes = 35 bytes.
  for (let i = 0; i < STRKEY_LENGTH; i += 8) {
    const c0 = input.charCodeAt(i);
    const c1 = input.charCodeAt(i + 1);
    const c2 = input.charCodeAt(i + 2);
    const c3 = input.charCodeAt(i + 3);
    const c4 = input.charCodeAt(i + 4);
    const c5 = input.charCodeAt(i + 5);
    const c6 = input.charCodeAt(i + 6);
    const c7 = input.charCodeAt(i + 7);

    if (
      c0 >= 128 ||
      c1 >= 128 ||
      c2 >= 128 ||
      c3 >= 128 ||
      c4 >= 128 ||
      c5 >= 128 ||
      c6 >= 128 ||
      c7 >= 128
    ) {
      return null;
    }

    const v0 = BASE32_LOOKUP[c0]!;
    const v1 = BASE32_LOOKUP[c1]!;
    const v2 = BASE32_LOOKUP[c2]!;
    const v3 = BASE32_LOOKUP[c3]!;
    const v4 = BASE32_LOOKUP[c4]!;
    const v5 = BASE32_LOOKUP[c5]!;
    const v6 = BASE32_LOOKUP[c6]!;
    const v7 = BASE32_LOOKUP[c7]!;

    if ((v0 | v1 | v2 | v3 | v4 | v5 | v6 | v7) < 0) {
      return null;
    }

    out[outIndex++] = (v0 << 3) | (v1 >> 2);
    out[outIndex++] = ((v1 & 0x03) << 6) | (v2 << 1) | (v3 >> 4);
    out[outIndex++] = ((v3 & 0x0f) << 4) | (v4 >> 1);
    out[outIndex++] = ((v4 & 0x01) << 7) | (v5 << 2) | (v6 >> 3);
    out[outIndex++] = ((v6 & 0x07) << 5) | v7;
  }

  return out;
}

function crc16XModem(data: Uint8Array): number {
  let crc = 0x0000;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]! << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

function isValidStrKey(input: string, expectedVersionByte: number): boolean {
  const decoded = decodeBase32StrKey(input);
  if (!decoded) return false;
  if (decoded[0] !== expectedVersionByte) return false;

  const expectedCrc = crc16XModem(decoded.subarray(0, 33));
  const actualCrc = decoded[33]! | (decoded[34]! << 8);
  return expectedCrc === actualCrc;
}

/** Validate a Stellar Ed25519 public key (`G...` strkey, 56 chars). */
export function isValidEd25519PublicKey(key: string): boolean {
  return isValidStrKey(key, VERSION_BYTE_ED25519_PUBLIC_KEY);
}

/** Validate a Soroban contract ID (`C...` strkey, 56 chars). */
export function isValidContractId(contractId: string): boolean {
  return isValidStrKey(contractId, VERSION_BYTE_CONTRACT);
}
