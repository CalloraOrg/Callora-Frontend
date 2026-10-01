// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBalances } from "./useBalances";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function Probe({ accountId, onResult }: { accountId: string; onResult?: (r: ReturnType<typeof useBalances>) => void }) {
  const result = useBalances(accountId);
  onResult?.(result);
  return (
    <div>
      <span data-testid="status">{result.status}</span>
      <span data-testid="vault">{result.balances ? result.balances.vault : "unknown"}</span>
      <span data-testid="wallet">{result.balances ? result.balances.wallet : "unknown"}</span>
      <span data-testid="error">{result.error ?? "none"}</span>
      <button type="button" onClick={result.refresh}>
        Refresh
      </button>
    </div>
  );
}

/** Lets a test flip the account id the hook is keyed on. */
function Switcher({ initial, onAccount }: { initial: string; onAccount: (id: string) => void }) {
  const [accountId, setAccountId] = useState(initial);
  onAccount(setAccountId);
  return <Probe accountId={accountId} />;
}

describe("useBalances", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts in the loading state with no balances", () => {
    fetchMock.mockReturnValue(defer<Response>().promise);

    render(<Probe accountId="acct_1" />);

    expect(screen.getByTestId("status").textContent).toBe("loading");
    expect(screen.getByTestId("vault").textContent).toBe("unknown");
    expect(screen.getByTestId("wallet").textContent).toBe("unknown");
  });

  it("requests the active account and exposes the returned balances", async () => {
    fetchMock.mockResolvedValue(jsonOk({ vault: 284.62, wallet: 1260.5 }));

    render(<Probe accountId="acct_1" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/accounts/acct_1/balances",
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByTestId("vault").textContent).toBe("284.62");
    expect(screen.getByTestId("wallet").textContent).toBe("1260.5");
  });

  it("surfaces a failed request as unknown rather than zero", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as unknown as Response);

    render(<Probe accountId="acct_1" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"));
    expect(screen.getByTestId("vault").textContent).toBe("unknown");
    expect(screen.getByTestId("wallet").textContent).toBe("unknown");
    expect(screen.getByTestId("error").textContent).toMatch(/500/);
  });

  it("reports a network failure as an error state", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<Probe accountId="acct_1" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"));
    expect(screen.getByTestId("error").textContent).toMatch(/could not reach/i);
  });

  it("refetches and clears the previous error when refreshed", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)
      .mockResolvedValueOnce(jsonOk({ vault: 10, wallet: 20 }));

    render(<Probe accountId="acct_1" />);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"));

    act(() => {
      screen.getByRole("button", { name: "Refresh" }).click();
    });

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(screen.getByTestId("error").textContent).toBe("none");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-requests and drops stale balances when the account changes", async () => {
    const first = defer<Response>();
    fetchMock.mockReturnValueOnce(first.promise).mockResolvedValueOnce(jsonOk({ vault: 7, wallet: 8 }));

    let setAccountId!: (id: string) => void;
    render(<Switcher initial="acct_1" onAccount={setter => (setAccountId = setter)} />);

    act(() => setAccountId("acct_2"));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/accounts/acct_2/balances");
    expect(screen.getByTestId("vault").textContent).toBe("7");

    // The superseded request settles late and must not overwrite acct_2.
    await act(async () => {
      first.resolve(jsonOk({ vault: 999, wallet: 999 }));
      await first.promise;
    });
    expect(screen.getByTestId("vault").textContent).toBe("7");
  });

  it("aborts the in-flight request when the account changes", async () => {
    fetchMock.mockReturnValue(defer<Response>().promise);

    let setAccountId!: (id: string) => void;
    render(<Switcher initial="acct_1" onAccount={setter => (setAccountId = setter)} />);
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    act(() => setAccountId("acct_2"));

    expect(firstSignal.aborted).toBe(true);
  });

  it("aborts the in-flight request on unmount", () => {
    fetchMock.mockReturnValue(defer<Response>().promise);

    const { unmount } = render(<Probe accountId="acct_1" />);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("ignores an abort rejection instead of reporting an error", async () => {
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    render(<Probe accountId="acct_1" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId("status").textContent).toBe("loading");
    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("treats a payload without usable amounts as an error, not as a zero balance", async () => {
    fetchMock.mockResolvedValue(jsonOk({ vault: null, wallet: undefined }));

    render(<Probe accountId="acct_1" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"));
    expect(screen.getByTestId("vault").textContent).toBe("unknown");
  });

  it("keeps a real zero balance distinct from an unknown one", async () => {
    fetchMock.mockResolvedValue(jsonOk({ vault: 0, wallet: 0 }));

    render(<Probe accountId="acct_1" />);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(screen.getByTestId("vault").textContent).toBe("0");
  });
});
