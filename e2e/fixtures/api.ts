import type { Page } from "@playwright/test";

export const smokeApi = {
  id: "smoke-weather",
  name: "Smoke Weather API",
  provider: { name: "Callora E2E" },
  status: "operational",
  description: "Deterministic weather data for browser smoke tests.",
  pricePerRequest: 0.01,
  category: "Data & Analytics",
  endpoints: [
    {
      id: "forecast",
      title: "Current forecast",
      method: "GET",
      url: "/v1/forecast",
      price: 0.01,
      params: [{ name: "city", type: "string", required: true }],
      response: '{ "temperature": 21 }',
    },
  ],
} as const;

const TESTNET_RPC_URL = "https://soroban-e2e.invalid/rpc";
const TESTNET_VAULT_ID =
  "CBJZLUKQBWDMZPKNJAVONZ7GCCWADSETRXWOPN5Z3XWAUNI4F2R7XDYQ";
const TESTNET_USDC_ISSUER =
  "GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ";

export async function mockApiRoutes(
  page: Page,
  options: { catalogStatus?: number } = {},
): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());

    if (pathname === "/api/config") {
      await route.fulfill({
        json: {
          network: "testnet",
          rpcUrl: TESTNET_RPC_URL,
          vaultContractId: TESTNET_VAULT_ID,
          usdcIssuer: TESTNET_USDC_ISSUER,
          enableDemoOutcome: false,
        },
      });
      return;
    }

    if (pathname === "/api/apis" && options.catalogStatus) {
      await route.fulfill({
        status: options.catalogStatus,
        json: { message: "Catalogue unavailable" },
      });
      return;
    }

    if (pathname === "/api/apis") {
      await route.fulfill({ json: { data: [smokeApi] } });
      return;
    }

    if (pathname === `/api/apis/${smokeApi.id}/health`) {
      await route.fulfill({ json: { points: [] } });
      return;
    }

    if (pathname === `/api/apis/${smokeApi.id}`) {
      await route.fulfill({ json: { data: smokeApi } });
      return;
    }

    if (pathname === "/api/auth/wallet" || pathname === "/api/auth/refresh") {
      await route.fulfill({
        json: {
          data: {
            accessToken: "playwright-access-token",
            refreshToken: "playwright-refresh-token",
          },
        },
      });
      return;
    }

    if (pathname === "/api/balances") {
      await route.fulfill({
        json: { data: { vault: "100.0000000", wallet: "1000.0000000" } },
      });
      return;
    }

    await route.fulfill({ json: { data: [], meta: { total: 0 } } });
  });
}
