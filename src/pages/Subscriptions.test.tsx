import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import type { Subscription } from "../api/subscriptionsApi";
import * as api from "../api/subscriptionsApi";
import Subscriptions from "./Subscriptions";

vi.mock("../api/subscriptionsApi", async (importOriginal) => ({ ...await importOriginal<typeof import("../api/subscriptionsApi")>(), listSubscriptions: vi.fn(), changePlan: vi.fn(), cancelSubscription: vi.fn() }));
const mockApi = vi.mocked(api);
const sub = (overrides: Partial<Subscription> = {}): Subscription => ({ id: "sub-1", apiName: "Weather API", planId: "pro", status: "active", renewalDate: "2026-12-01T00:00:00Z", monthlyRequests: 1000, pricePerRequest: 0.001, ...overrides });
function renderPage() { return render(<MemoryRouter><ToastProvider><Subscriptions /></ToastProvider></MemoryRouter>); }

describe("Subscriptions page", () => {
  beforeEach(() => { vi.clearAllMocks(); mockApi.listSubscriptions.mockResolvedValue([sub()]); });
  it("lists plans and monthly estimates, and handles empty state", async () => {
    renderPage();
    expect(await screen.findByText("Weather API")).toBeInTheDocument();
    expect(screen.getByText("Pro", { selector: "span" })).toBeInTheDocument();
    mockApi.listSubscriptions.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    expect(await screen.findByText("No subscriptions yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse marketplace" })).toHaveAttribute("href", "/marketplace");
    unmount();
  });
  it("shows load error and retry", async () => {
    mockApi.listSubscriptions.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  });
  it("optimistically changes plan, closes on success, and rolls back on failure", async () => {
    let reject!: (reason: Error) => void;
    mockApi.changePlan.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    renderPage();
    await screen.findByText("Weather API");
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Choose free" }));
    expect(within(screen.getByRole("dialog")).getByLabelText(/Free plan/)).toBeInTheDocument();
    reject(new Error("failed"));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByLabelText(/Pro plan/)).toBeInTheDocument());
    expect(await screen.findByText("failed")).toBeInTheDocument();
    mockApi.changePlan.mockResolvedValueOnce(sub({ planId: "free" }));
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Choose free" }));
    await waitFor(() => expect(mockApi.changePlan).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText(/Free plan/)).toBeInTheDocument();
  });
  it("requires cancellation confirmation and reports period end; failure keeps dialog open", async () => {
    mockApi.cancelSubscription.mockRejectedValueOnce(new Error("cancel failed"));
    renderPage();
    await screen.findByText("Weather API");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/Access remains available until the end/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    expect(await screen.findByText("cancel failed")).toBeInTheDocument();
    mockApi.cancelSubscription.mockResolvedValueOnce(sub({ status: "cancelling" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    expect(await screen.findByText("cancelling")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
  it("does not offer plan changes to an enterprise plan and hides cancel for cancelling rows", async () => {
    mockApi.listSubscriptions.mockResolvedValueOnce([sub({ planId: "enterprise", status: "cancelling" })]);
    renderPage();
    await screen.findByText("Weather API");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Contact us" }));
    expect(mockApi.changePlan).not.toHaveBeenCalled();
  });
  it("guards against a double submit", async () => {
    let resolve!: (value: Subscription) => void;
    mockApi.changePlan.mockImplementation(() => new Promise((r) => { resolve = r; }));
    renderPage();
    await screen.findByText("Weather API");
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    const choose = await screen.findByRole("button", { name: "Choose free" });
    fireEvent.click(choose); fireEvent.click(choose);
    expect(mockApi.changePlan).toHaveBeenCalledTimes(1);
    resolve(sub({ planId: "free" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
