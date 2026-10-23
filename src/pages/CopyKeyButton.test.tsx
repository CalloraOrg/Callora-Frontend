// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CopyKeyButton from "./CopyKeyButton";

describe("CopyKeyButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders with default label", () => {
    render(<CopyKeyButton value="sk-test-key" />);
    expect(
      screen.getByRole("button", { name: /copy/i }),
    ).toBeTruthy();
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("renders with custom label", () => {
    render(<CopyKeyButton value="sk-test-key" label="Copy API Key" />);
    expect(
      screen.getByRole("button", { name: /copy api key/i }),
    ).toBeTruthy();
    expect(screen.getByText("Copy API Key")).toBeTruthy();
  });

  it("writes the key to the clipboard on click", async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    render(<CopyKeyButton value="sk-test-key-123" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith("sk-test-key-123");
  });

  it("shows copied feedback after successful copy", async () => {
    render(<CopyKeyButton value="sk-test-key" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    expect(screen.getByText("Key copied to clipboard")).toBeTruthy();
  });

  it("disables the button while in copied state", async () => {
    render(<CopyKeyButton value="sk-test-key" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  it("renders with custom className", () => {
    const { container } = render(
      <CopyKeyButton value="sk-test-key" className="my-custom-class" />,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("my-custom-class");
  });

  it("includes sr-only live region for screen readers", () => {
    render(<CopyKeyButton value="sk-test-key" />);
    const liveRegion = document.querySelector(".sr-only[aria-live='polite']");
    expect(liveRegion).toBeTruthy();
  });
});
