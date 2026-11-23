# Deposit flow

The `/billing` deposit modal signs transactions with Freighter and submits vault
deposits through Stellar RPC. Shared configuration lives in
`src/config/constants.ts`; wallet operations live in `src/services/walletService.ts`.
On-chain balance reads use `src/services/vaultReads.ts` and the `useVaultBalances`
hook in `src/hooks/useVaultBalances.ts`.

## Asset and network configuration

`STELLAR_USDC_ASSET` is `{ code: "USDC", issuer }`. The testnet default issuer is
`GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ`, whose Stellar Asset
Contract is `CAC7CFZ42L3LTTZCI4C3XI6UF7AHS2PYTNJ5QEG2PSLRGDGMWRQOZOT5`.
`VITE_STELLAR_USDC_ISSUER` overrides the issuer and is validated with
`StrKey.isValidEd25519PublicKey`. Mainnet and futurenet require an explicit issuer.
Invalid configuration blocks trustline and deposit actions before Horizon is called.
The configured vault must accept this asset; a public key alone cannot prove that
it matches the vault. See [Configuration](Configuration.md) and `.env.example`.

Freighter must use `STELLAR_NETWORK_PASSPHRASE`. `STELLAR_HORIZON_URL` selects the
same network for classic account lookups and trustline submission. Vault deposits
require `VITE_STELLAR_VAULT_CONTRACT_ID` and the configured Soroban RPC endpoint.

## On-chain balance reads

Balances are read via read-only Soroban simulation (no signatures, no ledger
writes):

- **Vault balance**: `vault.balance()` simulated against `STELLAR_VAULT_CONTRACT_ID`
- **USDC token**: `vault.get_usdc_token()` simulated once per session, cached
- **Wallet balance**: `balance(address)` simulated on the USDC Stellar Asset Contract

All three use `scValToNative` and keep stroops as `bigint` until formatting via
`formatUsdcStroops` (exact decimal, no `Number` conversion for values > 2^53).

The `useVaultBalances({ address })` hook returns:
- `vault` / `wallet` — stroops (`bigint | null`)
- `status` — `"idle" | "loading" | "ready" | "error"`
- `error` — human-readable failure reason
- `configured` — false when no vault contract is configured
- `refresh()` — debounced re-read (300 ms, in-flight dedupe)
- `updatedAt` — epoch ms of last successful read
- `revision` — increments on each successful read

Wallet read only runs once a Freighter address is known. Superseded responses are
ignored via a version counter. Loading shows fixed-size skeletons (`aria-busy`);
errors show an inline message with **Retry** and never render `0` as a balance.
A live region announces balance changes politely.

When no vault contract is configured (`STELLAR_VAULT_CONTRACT_ID` missing or
invalid), no RPC calls are made and the UI shows "Vault not configured".

Simulation source account: the connected address when available; otherwise the
fixed valid account `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF`
(safe because simulation never checks sequence or signatures and nothing is
submitted).

## Trustline step

... (rest unchanged)

Opening the modal checks Freighter, connects the selected account, verifies its
network, then calls `hasUsdcTrustline(address)`. It fetches Horizon
`GET /accounts/{address}` and matches **both** `asset_code` and `asset_issuer` in
`balances`. A zero USDC balance still counts as an existing trustline.

| Result | Modal behavior |
| --- | --- |
| `present` | Show **Approve Transaction** for a valid amount. |
| `missing` | Replace approval with **Add USDC trustline** and explain the additional **0.5 XLM base reserve**, plus the transaction fee. |
| `unfunded-account` | Horizon returned 404. Explain XLM funding and offer **Check USDC trustline again**. Show an account-specific Friendbot link only when `STELLAR_NETWORK === "testnet"`. |
| `unknown` | A network/HTTP/invalid-response failure prevents checking. Show a warning and allow approval. |

The trustline step uses native keyboard-operable buttons and links. Its status is
announced through a polite, atomic live region, linked to the action with
`aria-describedby`. Rejected wallet access offers **Connect Freighter** again.

**Add USDC trustline** reconnects the wallet and verifies the network, loads the
classic account sequence, and builds a transaction containing exactly one
`Operation.changeTrust` for `STELLAR_USDC_ASSET`. It has a bounded lifetime and uses
the configured passphrase when signing in Freighter. No payment, mint, deposit,
or other operation is included. Horizon's synchronous `POST /transactions` endpoint
receives the signed XDR and returns after ledger inclusion. Only a response with
`successful: true` counts as success. The modal then rechecks the selected account
before enabling deposit approval.

While adding, controls prevent duplicate submissions or closing the modal. A
rejected signature is a normal cancellation, detected by the existing
`isUserRejection` helper: stay at the trustline step without an error toast.
Other failures remain inline and allow another trustline check before retrying.
A trustline reserves XLM; it does not provide USDC. Minting/faucet logic for USDC
and live wallet balance display are outside this flow.

## Deposit stages and amounts

```mermaid
stateDiagram-v2
    [*] --> input: Open modal and check trustline
    input --> trustline: Missing trustline
    trustline --> input: Confirm changeTrust and recheck
    trustline --> trustline: Cancel signature or retry
    input --> approving: Approve valid amount (present or unknown)
    approving --> pending: Stellar RPC accepts transaction and returns hash
    pending --> confirmed: RPC confirms success
    approving --> failed: Rejection or submission failure
    pending --> locked: Confirmation timeout or lost RPC response (requires reconciliation)
    locked --> confirmed: Check status returns SUCCESS (balance updated)
    locked --> failed: Check status returns FAILED (or NOT_FOUND after 120s validity window)
    locked --> locked: Check status returns UNKNOWN / NOT_FOUND inside 120s window
    failed --> input: Retry deposit after definitive failure
    confirmed --> input: Deposit another amount
```

The amount starts at 50 USDC. `MIN_DEPOSIT` is 10 and presets are 10, 50, 100, and
500. Input normalizes separators and limits USDC precision to seven decimal places.
Validation rejects blank, nonnumeric, below-minimum, and above-displayed-wallet
amounts. The service independently validates positive amounts and precision.
Wallet and vault balances are read from Soroban via `useVaultBalances`; the Max
button fills the real wallet balance (truncated to 7 decimals), and validation
uses the chain-sourced wallet balance.

Approval reconnects the wallet and checks its current trustline again before
Soroban simulation, protecting against account changes since the initial check.
A newly missing line or unfunded account returns to the corresponding prerequisite
step. An unknown lookup permits simulation. The service prepares the vault's
`deposit(caller, amount)` invocation, signs via Freighter, submits to RPC, and
polls confirmation. The explorer link uses the hash returned by RPC.

**Balance read-back after deposit**: on confirmation, the modal sets an optimistic
vault balance (pre-deposit vault + deposit amount) labelled "pending refresh" and
calls `refresh()`. Once the debounced re-read completes, the optimistic value is
replaced with the fresh chain value. The revision counter ensures stale responses
are ignored.

Approving, pending, and trustline submission disable amount/preset/Max/Close/Cancel
controls. A definitive deposit failure permits **Retry deposit**, preserving the
amount.

When submission or confirmation polling times out or encounters ambiguous errors,
the deposit enters a locked reconciliation state (`depositRequiresReconciliation`).
The pending deposit record `{ hash, amount, submittedAt, network, contractId }` is
persisted in `sessionStorage` under `callora:deposit:pending` (guarded with try/catch).
An enabled **Check status** action calls `checkDepositStatus(hash)`. If `SUCCESS`,
the vault balance is credited, the pending record is cleared, and the flow reaches
confirmed. If `FAILED`, or if `NOT_FOUND` after the 120-second transaction validity
window (`TRANSACTION_TIMEOUT_SECONDS`), the modal transitions to failed with **Retry deposit**
unlocked. If `NOT_FOUND` inside 120 seconds or `UNKNOWN`, the modal remains locked
and displays the countdown timer. If closed, a banner outside the modal on the Billing
page alerts the user to check their unconfirmed deposit.

**Deposit another amount** resets to 50 USDC.

## Verification and PR recording (#1316)

Service and modal tests mock Horizon fetch and Freighter. They cover existing and
missing trustlines, unfunded accounts, network failure, a confirmed trustline,
signature cancellation, invalid issuer configuration, and mainnet without Friendbot.
The service test decodes the exact XDR passed to mocked `signTransaction` and asserts
one `changeTrust` operation with the configured asset. Run:

```sh
npx tsc -p tsconfig.json --noEmit
npm run build
npx vitest run
npm run test:coverage
```

For the required real-wallet recording:

1. Configure testnet and the deployed vault; select a fresh Freighter testnet account.
   The vault owner must allowlist it if the deployment restricts callers
   (`CallerNotInAllowlist`, contract error 44).
2. Open `/billing?deposit=true`. If unfunded, follow Friendbot and return to check again.
3. Record **Add USDC trustline**, its reserve explanation, Freighter's single
   changeTrust approval, ledger confirmation, and the resulting deposit approval.
4. With USDC supplied independently, complete the vault deposit and show its explorer
   result. USDC issuance is not part of this change.
5. Include a cancellation demonstration if useful. Attach the recording and actual
   command output to a PR linking `Closes #1316`.

Regression proof for row 2: on the original main branch, a wallet without the USDC
trustline can click **Approve Transaction**, reaches simulation, and receives a
generic failure. With this change, the same account is offered the trustline step
before a deposit can be simulated.

## Simulation failures before signing

Deposits explicitly call `simulateTransaction`, inspect `rpc.Api.isSimulationError`,
and only assemble a successful response with `rpc.assembleTransaction(...).build()`.
Contract rejections use `CONTRACT_REJECTED`, carry the decoded `contractErrorCode`
when available, and never require reconciliation: nothing was signed or submitted.
The modal shows the specific message/code and offers Retry. Raw host diagnostics,
XDR, and wallet addresses are never displayed or logged; `SecureErrorHandler`
receives only the classification and decoded numeric code.

| Vault code | Message/action |
| --- | --- |
| 1 | Vault is not initialized; contact the operator. |
| 4, 37 | Deposits are paused. |
| 6 | Amount must be positive. |
| 8 | Amount is below the vault minimum. |
| 9 | Amount cannot be accepted; try a smaller deposit. |
| 36 | Rate limit reached; wait before retrying. |
| 44 | Wallet is not on the deposit allowlist. |
| Other | Vault rejected the deposit, with the numeric code. |
| No contract code | Simulation could not prepare the deposit; no funds moved. |

Real account/RPC transport exceptions keep their existing connection/timeout
messages. Failures after submission keep the existing transaction and
reconciliation behavior. The decoder reads both the simulation error string and
structured contract-error values in diagnostic events.

## Withdrawals

The `/billing` page hosts a **Withdraw** button alongside the existing deposit control. The button is disabled when the wallet is disconnected, the network does not match, or the vault balance is zero.

### Vault contract assumption

The withdrawal path assumes the vault exposes `withdraw(to: Address, amount: i128)`, mirroring the deposit signature. This assumption must be confirmed against the deployed contract spec before mainnet use. The contract entry point name is documented in `src/services/walletService.ts`.

### Withdrawal flow

```mermaid
stateDiagram-v2
    [*] --> input: Open WithdrawModal
    input --> approving: Confirm valid amount
    approving --> pending: Stellar RPC accepts and returns hash
    pending --> confirmed: RPC confirms success
    approving --> failed: Rejection or submission failure
    pending --> failed: Confirmation timeout or lost response
    failed --> input: Retry withdrawal
    confirmed --> input: Withdraw again
```

Clicking **Withdraw** opens `WithdrawModal`. The amount field is validated before any wallet prompt:

| Condition | Behaviour |
| --- | --- |
| Empty or non-numeric | Confirm button disabled |
| Zero or negative | Confirm button disabled |
| More than 7 decimal places | Validation error shown |
| Exceeds vault balance | Validation error shown |
| **Max** button | Fills the field with the vault balance (truncated to 7 decimals) |

On confirm, `submitVaultWithdraw` (in `walletService.ts`) builds a Soroban transaction calling `withdraw(address, amount_i128)`, simulates it, assembles it, signs via Freighter, submits, and polls confirmation. The flow is byte-for-byte identical to the deposit path except:

- No USDC trustline check (the wallet receives USDC, not sends it).
- Uses withdraw-specific error messages via `decodeVaultError(simulation, "withdraw")`.

After confirmation, `refresh()` from `useVaultBalances` is called and a success toast with the Stellar Explorer link is shown via `buildExplorerLink`.

### Error handling

Contract simulation errors are decoded by `decodeVaultError` with `action = "withdraw"`. Withdraw-specific messages (e.g. insufficient vault balance, withdrawal paused) are defined in `WITHDRAW_MESSAGES` in `src/services/vaultErrors.ts`. Raw XDR or host error strings never appear in the UI.

### Implementation files

| File | Change |
| --- | --- |
| `src/services/walletService.ts` | Added `preflightVaultWithdraw`, `submitVaultWithdraw`, `SubmittedWithdraw` |
| `src/services/vaultErrors.ts` | Parameterised `decodeVaultError` with `action`; added `WITHDRAW_MESSAGES` |
| `src/components/WithdrawModal.tsx` | New modal component |
| `src/App.tsx` | Withdraw button on billing page, `WithdrawModal` mounted |
| `src/components/WithdrawModal.test.tsx` | Validation and stage-transition tests |
