// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountSwitcher from "./AccountSwitcher";
import { AccountProvider, DEFAULT_ACCOUNT_ID, useAccountId } from "../hooks/useAccount";

function AccountProbe() {
  return <span data-testid="active-account">{useAccountId()}</span>;
}

function renderSwitcher(ui: React.ReactNode = <AccountSwitcher />) {
  return render(
    <AccountProvider>
      {ui}
      <AccountProbe />
    </AccountProvider>,
  );
}

describe("AccountSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(cleanup);

  it("renders a labelled control with one option per account", () => {
    renderSwitcher();

    const select = screen.getByLabelText("Account") as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(screen.getByRole("option", { name: "Primary account" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Secondary account" })).toBeTruthy();
  });

  it("selects the default account on first render", () => {
    renderSwitcher();

    expect((screen.getByLabelText("Account") as HTMLSelectElement).value).toBe(DEFAULT_ACCOUNT_ID);
    expect(screen.getByTestId("active-account").textContent).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("switches the active account when the selection changes", () => {
    renderSwitcher();

    const select = screen.getByLabelText("Account") as HTMLSelectElement;
    act(() => {
      fireEvent.change(select, { target: { value: "acct_secondary" } });
    });

    expect(select.value).toBe("acct_secondary");
    expect(screen.getByTestId("active-account").textContent).toBe("acct_secondary");
  });

  it("ignores a selection that is not a known account", () => {
    renderSwitcher();

    const select = screen.getByLabelText("Account") as HTMLSelectElement;
    act(() => {
      fireEvent.change(select, { target: { value: "acct_attacker" } });
    });

    expect(screen.getByTestId("active-account").textContent).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("restores the persisted selection on the next mount", () => {
    const first = renderSwitcher();
    act(() => {
      fireEvent.change(screen.getByLabelText("Account"), { target: { value: "acct_secondary" } });
    });
    first.unmount();
    cleanup();

    renderSwitcher();
    expect((screen.getByLabelText("Account") as HTMLSelectElement).value).toBe("acct_secondary");
  });

  it("falls back to the default account when storage holds an unknown id", () => {
    localStorage.setItem("callora.activeAccountId", JSON.stringify("acct_deleted"));

    renderSwitcher();

    expect((screen.getByLabelText("Account") as HTMLSelectElement).value).toBe(DEFAULT_ACCOUNT_ID);
    expect(screen.getByTestId("active-account").textContent).toBe(DEFAULT_ACCOUNT_ID);
  });

  it("renders without a provider by using the default account", () => {
    const onError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <AccountSwitcher />
        <AccountProbe />
      </>,
    );

    expect(screen.getByTestId("active-account").textContent).toBe(DEFAULT_ACCOUNT_ID);
    onError.mockRestore();
  });
});
