import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthenticatedAccount } from "../api/accountApi";
import { _reset, addAccount, getKnownAccounts, switchAccount } from "../state/accountStore";
import { AccountProvider, useAccountContext } from "./useAccountContext";

vi.mock("../api/accountApi", () => ({ fetchAuthenticatedAccount: vi.fn() }));

function Probe() {
  const { account, accounts } = useAccountContext();
  return <div><span data-testid="account-id">{account?.id ?? "none"}</span><span data-testid="account-count">{accounts.length}</span></div>;
}

beforeEach(() => {
  localStorage.clear();
  _reset();
  vi.mocked(fetchAuthenticatedAccount).mockReset();
  vi.mocked(fetchAuthenticatedAccount).mockResolvedValue(null);
});

describe("AccountProvider", () => {
  it("renders children while authenticated discovery is pending", () => {
    vi.mocked(fetchAuthenticatedAccount).mockReturnValue(new Promise(() => {}));
    render(<AccountProvider><Probe /></AccountProvider>);
    expect(screen.getByTestId("account-id")).toHaveTextContent("none");
    expect(screen.getByTestId("account-count")).toHaveTextContent("0");
  });

  it("adds and selects the authenticated account without an API key", async () => {
    vi.mocked(fetchAuthenticatedAccount).mockResolvedValue({ id: "server-account", label: "Server account" });
    render(<AccountProvider><Probe /></AccountProvider>);
    await waitFor(() => expect(screen.getByTestId("account-id")).toHaveTextContent("server-account"));
    expect(screen.getByTestId("account-count")).toHaveTextContent("1");
    expect(getKnownAccounts()[0]).not.toHaveProperty("apiKey");
  });

  it("preserves local account state when authenticated discovery fails", async () => {
    addAccount({ id: "local-account", label: "Local account" });
    switchAccount("local-account");
    vi.mocked(fetchAuthenticatedAccount).mockRejectedValue(new Error("network unavailable"));
    render(<AccountProvider><Probe /></AccountProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("account-id")).toHaveTextContent("local-account");
    expect(screen.getByTestId("account-count")).toHaveTextContent("1");
  });
});
