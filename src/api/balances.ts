/**
 * Balances API client.
 *
 * Reads the vault + wallet balances of a single account from
 * `GET /api/accounts/:id/balances`. In development the Vite dev server proxies
 * `/api` to the backend (see `vite.config.ts`), so relative URLs are used and
 * no absolute host is ever hardcoded into the bundle.
 *
 * Design notes:
 * - Amounts arrive from a network boundary, so every field is validated before
 *   it reaches component state. An unparseable amount is an error, never `0`:
 *   a silent `Number("") === 0` would let a broken payload masquerade as an
 *   empty vault and trip the low-balance banner.
 * - Error messages carry only the HTTP status. Response bodies are never
 *   surfaced because they can contain account metadata that does not belong in
 *   a toast or a banner.
 */

/** Balances of one account, denominated in USDC. */
export interface AccountBalances {
  /** USDC held in the Callora vault reserve. */
  vault: number;
  /** USDC available in the connected wallet for the next deposit. */
  wallet: number;
}

/** Reason codes attached to a {@link BalancesRequestError}. */
export type BalancesErrorReason =
  | "invalid-account"
  | "request-failed"
  | "invalid-response"
  | "network";

/** Error thrown for every non-successful balances request. */
export class BalancesRequestError extends Error {
  readonly reason: BalancesErrorReason;
  /** HTTP status code, or `null` when the request never produced a response. */
  readonly status: number | null;

  constructor(reason: BalancesErrorReason, message: string, status: number | null = null) {
    super(message);
    this.name = "BalancesRequestError";
    this.reason = reason;
    this.status = status;
  }
}

export interface FetchBalancesOptions {
  /** Aborts the in-flight request, e.g. when the user switches account. */
  signal?: AbortSignal;
  /** Injection seam for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Build the balances endpoint for an account id. */
export function balancesPath(accountId: string): string {
  return `/api/accounts/${encodeURIComponent(accountId)}/balances`;
}

/**
 * Detect a cancelled request.
 *
 * `instanceof Error` is unreliable for `DOMException` (it does not extend
 * `Error` in every runtime), so the error name is read structurally.
 */
function isAbort(error: unknown, signal?: AbortSignal): boolean {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return signal?.aborted === true || name === "AbortError";
}

/** Decimal pattern accepted for string amounts, including exponent notation. */
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Coerce a raw payload field into a non-negative amount.
 *
 * Returns `null` for anything that is not a usable amount (missing, null,
 * boolean, object, empty/whitespace string, non-numeric string, NaN, Infinity
 * or a negative value) so callers can reject the whole payload.
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0 || !DECIMAL_PATTERN.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function readPair(source: unknown): { vault: unknown; wallet: unknown } | null {
  if (typeof source !== "object" || source === null || Array.isArray(source)) return null;

  const record = source as Record<string, unknown>;
  const vault = record.vault ?? record.vaultBalance;
  const wallet = record.wallet ?? record.walletBalance;

  if (vault === undefined && wallet === undefined) return null;
  return { vault, wallet };
}

/**
 * Extract the balance pair from a response payload.
 *
 * Tolerates the shapes the backend has used so far: a bare pair, a `balances`
 * or `data` envelope, and `vaultBalance` / `walletBalance` key aliases.
 *
 * @throws BalancesRequestError when either amount is missing or unusable.
 */
export function parseBalancesPayload(payload: unknown): AccountBalances {
  const candidates = [payload];

  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    candidates.push(record.balances, record.data);
  }

  for (const candidate of candidates) {
    const pair = readPair(candidate);
    if (!pair) continue;

    const vault = parseAmount(pair.vault);
    const wallet = parseAmount(pair.wallet);

    if (vault === null || wallet === null) continue;

    return { vault, wallet };
  }

  throw new BalancesRequestError(
    "invalid-response",
    "The balances service returned an unexpected response.",
  );
}

/**
 * Fetch the vault and wallet balances for an account.
 *
 * @throws BalancesRequestError on an unusable account id, a non-2xx response,
 *         an unparsable body, or a payload without a usable balance pair.
 */
export async function fetchAccountBalances(
  accountId: string,
  { signal, fetchImpl }: FetchBalancesOptions = {},
): Promise<AccountBalances> {
  if (typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new BalancesRequestError("invalid-account", "An account id is required to load balances.");
  }

  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new BalancesRequestError("network", "Balances are unavailable in this environment.");
  }

  let response: Response;
  try {
    response = await doFetch(balancesPath(accountId), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    // Re-throw aborts untouched so callers can ignore superseded requests
    // instead of showing them as a failure.
    if (isAbort(error, signal)) throw error;
    throw new BalancesRequestError("network", "Could not reach the balances service.", null);
  }

  if (!response.ok) {
    throw new BalancesRequestError(
      "request-failed",
      `The balances service responded with ${response.status}.`,
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BalancesRequestError(
      "invalid-response",
      "The balances service returned a response that could not be read.",
      response.status,
    );
  }

  return parseBalancesPayload(payload);
}
