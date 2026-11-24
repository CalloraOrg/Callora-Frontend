import type { Page, Route } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  Address,
  Keypair,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const TESTNET_USDC_ISSUER =
  "GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ";
const TESTNET_USDC_TOKEN_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

type FreighterTestWindow = Window & {
  freighter?: boolean;
  __freighterSignTransaction?: (transactionXdr: string) => Promise<string>;
};

type WalletMessage = {
  source?: string;
  messageId?: number;
  type?: string;
  transactionXdr?: string;
};

type RpcRequest = {
  id?: number | string;
  method?: string;
  params?: {
    hash?: string;
    keys?: string[];
    transaction?: string;
  };
};

function accountLedgerEntry(address: string) {
  const accountId = Keypair.fromPublicKey(address).xdrPublicKey();
  const key = xdr.LedgerKey.account(new xdr.LedgerKeyAccount({ accountId }));
  const entry = new xdr.AccountEntry({
    accountId,
    balance: 100_000_000_000n,
    seqNum: 1n,
    numSubEntries: 0,
    inflationDest: null,
    flags: 0,
    homeDomain: "",
    thresholds: new Uint8Array([1, 1, 1, 1]),
    signers: [],
    ext: xdr.AccountEntryExt.v0(),
  });

  return {
    keyXdr: key.toXDR("base64"),
    entryXdr: xdr.LedgerEntryData.account(entry).toXDR("base64"),
  };
}

function transactionDataXdr(): string {
  return new xdr.SorobanTransactionData({
    ext: xdr.SorobanTransactionDataExt.v0(),
    resources: new xdr.SorobanResources({
      footprint: new xdr.LedgerFootprint({ readOnly: [], readWrite: [] }),
      instructions: 1,
      diskReadBytes: 0,
      writeBytes: 0,
    }),
    resourceFee: 0n,
  }).toXDR("base64");
}

async function replyToRpc(
  route: Route,
  accountEntry: ReturnType<typeof accountLedgerEntry>,
  submittedEnvelope: { current: string },
): Promise<void> {
  const request = route.request().postDataJSON() as RpcRequest;
  const resultBase = { jsonrpc: "2.0", id: request.id };

  if (request.method === "getLedgerEntries") {
    await route.fulfill({
      json: {
        ...resultBase,
        result: {
          latestLedger: 1,
          entries: [
            {
              key: request.params?.keys?.[0] ?? accountEntry.keyXdr,
              xdr: accountEntry.entryXdr,
              lastModifiedLedgerSeq: 1,
            },
          ],
        },
      },
    });
    return;
  }

  if (request.method === "simulateTransaction") {
    const transactionXdr = request.params?.transaction;
    if (!transactionXdr) {
      await route.fulfill({
        status: 400,
        json: { ...resultBase, error: { code: -32602, message: "Missing transaction" } },
      });
      return;
    }

    const transaction = TransactionBuilder.fromXDR(
      transactionXdr,
      TESTNET_PASSPHRASE,
    );
    const operation = transaction.operations[0];
    if (
      !operation ||
      operation.type !== "invokeHostFunction" ||
      operation.func.type !== "hostFunctionTypeInvokeContract"
    ) {
      await route.fulfill({
        status: 400,
        json: { ...resultBase, error: { code: -32602, message: "Unsupported operation" } },
      });
      return;
    }

    const method = operation.func.value.functionName.toString();
    const returnValue =
      method === "get_usdc_token"
        ? new Address(TESTNET_USDC_TOKEN_ID).toScVal()
        : method === "is_paused"
          ? nativeToScVal(false, { type: "bool" })
          : method === "is_authorized_depositor"
            ? nativeToScVal(true, { type: "bool" })
            : method === "deposit"
              ? xdr.ScVal.scvVoid()
              : nativeToScVal(1_000_000_000n, { type: "i128" });

    await route.fulfill({
      json: {
        ...resultBase,
        result: {
          latestLedger: 1,
          transactionData: transactionDataXdr(),
          minResourceFee: "0",
          events: [],
          results: [{ auth: [], xdr: returnValue.toXDR("base64") }],
        },
      },
    });
    return;
  }

  if (request.method === "sendTransaction") {
    const transactionXdr = request.params?.transaction;
    if (!transactionXdr) {
      await route.fulfill({
        status: 400,
        json: { ...resultBase, error: { code: -32602, message: "Missing transaction" } },
      });
      return;
    }
    submittedEnvelope.current = transactionXdr;
    await route.fulfill({
      json: {
        ...resultBase,
        result: { status: "PENDING", hash: "e2e-deposit-transaction-hash" },
      },
    });
    return;
  }

  if (request.method === "getTransaction") {
    await route.fulfill({
      json: {
        ...resultBase,
        result: {
          status: "SUCCESS",
          latestLedger: 1,
          latestLedgerCloseTime: "0",
          oldestLedger: 1,
          oldestLedgerCloseTime: "0",
          ledger: 1,
          createdAt: new Date(0).toISOString(),
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: submittedEnvelope.current,
          resultXdr: new xdr.TransactionResult({
            feeCharged: 100n,
            result: xdr.TransactionResultResult.txSuccess([]),
            ext: xdr.TransactionResultExt.v0(),
          }).toXDR("base64"),
          resultMetaXdr: xdr.TransactionMeta.operations([]).toXDR("base64"),
        },
      },
    });
    return;
  }

  await route.fulfill({
    status: 400,
    json: {
      ...resultBase,
      error: { code: -32601, message: `Unsupported RPC method: ${request.method}` },
    },
  });
}

export async function installFreighterStub(page: Page): Promise<string> {
  const testSeed = createHash("sha256")
    .update("callora-playwright-freighter-test")
    .digest();
  const keypair = Keypair.fromRawEd25519Seed(testSeed);
  const address = keypair.publicKey();

  await page.exposeFunction(
    "__freighterSignTransaction",
    (transactionXdr: string) => {
      const transaction = new Transaction(transactionXdr, TESTNET_PASSPHRASE);
      transaction.sign(keypair);
      return transaction.toXDR();
    },
  );

  await page.addInitScript(
    ({ walletAddress, networkPassphrase }) => {
      let installed = true;
      Object.defineProperty(window, "freighter", {
        configurable: true,
        get: () => installed,
        set: (value: unknown) => {
          installed = Boolean(value);
        },
      });

      window.addEventListener("message", (event: MessageEvent<WalletMessage>) => {
        if (
          event.source !== window ||
          event.data?.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST"
        ) {
          return;
        }

        const request = event.data;
        const respond = async () => {
          let data: Record<string, unknown> = {};
          switch (request.type) {
            case "REQUEST_CONNECTION_STATUS":
              data = { isConnected: installed };
              break;
            case "REQUEST_ALLOWED_STATUS":
              data = { isAllowed: true };
              break;
            case "REQUEST_PUBLIC_KEY":
            case "REQUEST_ACCESS":
              data = { publicKey: walletAddress };
              break;
            case "REQUEST_NETWORK_DETAILS":
              data = {
                networkDetails: {
                  network: "TESTNET",
                  networkName: "Testnet",
                  networkUrl: "https://horizon-testnet.stellar.org",
                  networkPassphrase,
                },
              };
              break;
            case "SUBMIT_BLOB":
              data = { signedBlob: "playwright-test-signature", signerAddress: walletAddress };
              break;
            case "SUBMIT_TRANSACTION":
              {
                const sign = (window as FreighterTestWindow)
                  .__freighterSignTransaction;
                if (!sign) throw new Error("Freighter test signer is unavailable.");
                data = {
                  signedTransaction: await sign(
                    request.transactionXdr ?? "",
                  ),
                  signerAddress: walletAddress,
                };
              }
              break;
            default:
              return;
          }

          window.postMessage(
            {
              source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
              messagedId: request.messageId,
              ...data,
            },
            window.location.origin,
          );
        };
        void respond();
      });
    },
    { walletAddress: address, networkPassphrase: TESTNET_PASSPHRASE },
  );

  return address;
}

export async function mockStellarNetwork(
  page: Page,
  walletAddress: string,
): Promise<void> {
  const accountEntry = accountLedgerEntry(walletAddress);
  const submittedEnvelope = { current: "" };

  await page.route("https://soroban-e2e.invalid/rpc", (route) =>
    replyToRpc(route, accountEntry, submittedEnvelope),
  );
  await page.route("https://horizon-testnet.stellar.org/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/fee_stats")) {
      await route.fulfill({
        json: { fee_charged: { mode: "100" }, max_fee: { mode: "100" } },
      });
      return;
    }

    await route.fulfill({
      json: {
        sequence: "1",
        balances: [
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: TESTNET_USDC_ISSUER,
            balance: "1000.0000000",
          },
        ],
      },
    });
  });
}
