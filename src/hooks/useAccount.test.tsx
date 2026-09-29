// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AccountProvider,
  ACTIVE_ACCOUNT_STORAGE_KEY,
  DEFAULT_ACCOUNT_ID,
  useAccountId,
  useAccounts,
} from "./useAccount";

function Probe() {
  const { account, accountId, setAccountId } = useAccounts();
  return (
    <div>
      <span data-testid="account-id">{accountId}</span>
      <span data-testid="account-name">{account.name}</span>
      <button type="button" onClick={() => setAccountId("acct_secondary")}>
        Switch
      </button>
      <button type="button" onClick={() => setAccountId("acct_unknown")}>
        Switch to unknown
      </button>
    </div>
  );
}

function useAccountIdOutsideProvider() {
  return function OutsideProviderProbe() {
    return (
      <>
        <span data-testid="raw-account-id">{useAccountId()}</span>
        <Probe />
      </>
    );
  };
}

describe("useAccount", () => {
  const OutsideProviderProbe = useAccountIdOutsideProvider();

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(cleanup);

  it("exposes the default account without a provider", () => {
    render(<OutsideProviderProbe />);

    expect(screen.getByTestId("raw-account-id").textContent).toBe(DEFAULT_ACCOUNT_ID);
    expect(screen.getByTestId("account-id").textContent).toBe(DEFAULT_ACCOUNT_ID);
    expect(screen.getByTestId("account-name").textContent).toBe("Primary account");
  });

  it("switches the active account through the context action", () => {
    render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Switch" }).click();
    });

    expect(screen.getByTestId("account-id").textContent).toBe("acct_secondary");
    expect(screen.getByTestId("account-name").textContent).toBe("Secondary account");
  });

  it("ignores an unknown account id", () => {
    render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Switch to unknown" }).click();
    });

    expect(screen.getByTestId("account-id").textContent).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("persists the selection so a reload keeps the same account", () => {
    const first = render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Switch" }).click();
    });
    first.unmount();
    cleanup();

    expect(JSON.parse(localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) as string)).toBe("acct_secondary");

    render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );
    expect(screen.getByTestId("account-id").textContent).toBe("acct_secondary");
  });

  it("falls back to the default account when storage holds a removed account", () => {
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify("acct_removed"));

    render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );

    expect(screen.getByTestId("account-id").textContent).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("honours an explicit initial account", () => {
    render(
      <AccountProvider initialAccountId="acct_secondary">
        <Probe />
      </AccountProvider>,
    );

    expect(screen.getByTestId("account-id").textContent).toBe("acct_secondary");
  });

  it("survives corrupt storage instead of throwing", () => {
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, "{not json");

    render(
      <AccountProvider>
        <Probe />
      </AccountProvider>,
    );

    expect(screen.getByTestId("account-id").textContent).toBe(DEFAULT_ACCOUNT_ID);
  });
});
