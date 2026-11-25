import { expect, test } from "@playwright/test";
import { mockApiRoutes } from "./fixtures/api";
import { installFreighterStub, mockStellarNetwork } from "./fixtures/freighter";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const { hostname } = new URL(route.request().url());
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return route.continue();
    }
    return route.abort();
  });

  const walletAddress = await installFreighterStub(page);
  await mockStellarNetwork(page, walletAddress);
});

test("landing, marketplace, API details, and deposit work end to end", async ({
  page,
}) => {
  await mockApiRoutes(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Callora - Programmable API Access" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Start Using APIs/i }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
  await page.getByRole("button", { name: "View details for Smoke Weather API" }).click();
  await expect(page).toHaveURL(/\/details\/smoke-weather$/);
  await expect(
    page.getByRole("heading", { name: "Smoke Weather API" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Documentation" }).click();
  await expect(page.getByRole("tab", { name: "Documentation" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: "Pricing Plans" })).toBeVisible();

  await page.goto("/billing");
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(
    page.getByRole("heading", { name: "Review every number before you approve." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open deposit modal" }).click();
  const depositDialog = page.getByRole("dialog", { name: "Deposit USDC to Vault" });
  await expect(depositDialog.getByText("USDC trustline ready.")).toBeVisible();
  await depositDialog.getByRole("button", { name: "Approve deposit transaction" }).click();
  await expect(
    depositDialog.getByRole("button", { name: "Confirm and sign deposit transaction" }),
  ).toBeVisible();
  await depositDialog
    .getByRole("button", { name: "Confirm and sign deposit transaction" })
    .click();
  await expect(depositDialog.getByText("Deposit successful")).toBeVisible();
});

test("shows the missing-wallet prompt when Freighter is unavailable", async ({
  page,
}) => {
  await mockApiRoutes(page);
  await page.goto("/billing");
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(
    page.getByRole("heading", { name: "Review every number before you approve." }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { freighter?: boolean }).freighter = false;
  });

  await page.getByRole("button", { name: "Open deposit modal" }).click();
  await expect(
    page.getByText("Install Freighter to sign this Stellar deposit."),
  ).toBeVisible();
});

test("shows the marketplace error state for a failed catalogue request", async ({
  page,
}) => {
  await mockApiRoutes(page, { catalogStatus: 500 });
  await page.goto("/marketplace");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
