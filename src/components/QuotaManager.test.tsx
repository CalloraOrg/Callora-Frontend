import { render, screen, fireEvent, act } from "@testing-library/react";
import QuotaManager from "./QuotaManager";
import { QuotaStore } from "../state/quotaStore";
import { makeFakeApi } from "../state/quotaTestUtils";

function record(accountId: string, value: number, version: number) {
  return { accountId, value, version, updatedAt: version };
}

function setup(props: { accountId?: string; accounts?: string[] } = {}) {
  const fake = makeFakeApi();
  const store = new QuotaStore({ api: fake.api, tabId: "test" });
  render(<QuotaManager store={store} {...props} />);
  return { fake, store };
}

describe("QuotaManager", () => {
  it("shows a loading state then the authoritative value", async () => {
    const { fake } = setup({ accountId: "a" });
    expect(screen.getByText(/Loading quota/i)).toBeTruthy();

    await act(async () => {
      fake.resolveFetch(0, record("a", 100, 1));
    });

    expect(screen.queryByText(/Loading quota/i)).toBeNull();
    expect(screen.getByDisplayValue("100")).toBeTruthy();
  });

  it("renders an error state with a retry control", async () => {
    const { fake } = setup({ accountId: "a" });
    await act(async () => {
      fake.rejectFetch(0, new Error("boom"));
    });

    expect(screen.getByText(/Could not load quota/i)).toBeTruthy();
    const retry = screen.getByRole("button", { name: /Retry/i });
    expect(retry).toBeTruthy();

    await act(async () => {
      fireEvent.click(retry);
      fake.resolveFetch(1, record("a", 100, 1));
    });

    expect(screen.getByDisplayValue("100")).toBeTruthy();
  });

  it("never reports an unconfirmed mutation as successful", async () => {
    const { fake } = setup({ accountId: "a" });
    await act(async () => {
      fake.resolveFetch(0, record("a", 100, 1));
    });

    const input = screen.getByDisplayValue("100") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "150" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save quota/i }));
    });

    // While in-flight, the status must read "Saving…", never "Synced".
    expect(screen.getAllByText(/Saving/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Synced/i)).toBeNull();
    expect(input.value).toBe("150"); // optimistic draft still shown

    await act(async () => {
      fake.resolveUpdate(0, record("a", 150, 2));
    });

    expect(screen.getByText(/Synced/i)).toBeTruthy();
  });

  it("surfaces a failure and supports retry", async () => {
    const { fake } = setup({ accountId: "a" });
    await act(async () => {
      fake.resolveFetch(0, record("a", 100, 1));
    });

    const input = screen.getByDisplayValue("100") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "150" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save quota/i }));
      fake.rejectUpdate(0, new Error("Network down"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Network down/i)).toBeTruthy();
    const retry = screen.getByRole("button", { name: /Retry/i });
    expect(retry).toBeTruthy();

    await act(async () => {
      fireEvent.click(retry);
      fake.resolveUpdate(1, record("a", 150, 2)); // re-submit
    });

    expect(screen.getByText(/Synced/i)).toBeTruthy();
  });

  it("shows a stale banner after a cross-tab conflict reconciliation", async () => {
    const fake = makeFakeApi({ a: 100 });
    const store = new QuotaStore({ api: fake.api, tabId: "test" });
    render(<QuotaManager store={store} accountId="a" />);

    await act(async () => {
      fake.resolveFetch(0, record("a", 100, 1));
    });

    const input = screen.getByDisplayValue("100") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "150" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save quota/i }));
      fake.rejectLastUpdateConflict(2, "a");
    });
    // Let the conflict catch run and open the reconcile fetch.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      fake.resolveFetch(1, record("a", 100, 2)); // reconcile to server
    });

    expect(screen.getByText(/Updated in another tab/i)).toBeTruthy();
  });

  it("switches accounts without mixing their values", async () => {
    const { fake, store } = setup({
      accountId: "a",
      accounts: ["a", "b"],
    });

    await act(async () => {
      fake.resolveFetch(0, record("a", 100, 1));
    });
    expect(screen.getByDisplayValue("100")).toBeTruthy();

    const select = screen.getByLabelText(/Account/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "b" } });
      fake.resolveFetch(1, record("b", 50, 1));
    });

    expect(store.getSnapshot().currentAccountId).toBe("b");
    expect(screen.getByDisplayValue("50")).toBeTruthy();
  });
});
