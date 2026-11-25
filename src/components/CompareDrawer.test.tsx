// @vitest-environment jsdom

import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import CompareDrawer from "./CompareDrawer";
import { compareStore } from "../state/compareStore";
import { parseCompareIds } from "../utils/compareUrl";
import type { APIItem } from "../data/mockApis";

function makeApi(id: string, name: string): APIItem {
  return {
    id,
    name,
    description: `${name} description`,
    category: "Data",
    pricePerRequest: 0.005,
    endpoints: [],
  } as unknown as APIItem;
}

describe("CompareDrawer", () => {
  const writeTextMock = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    compareStore.clear();
    localStorage.clear();
    writeTextMock.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  afterEach(() => {
    compareStore.clear();
    localStorage.clear();
    cleanup();
  });

  it("copies a shareable URL that round-trips through parseCompareIds and announces success", async () => {
    writeTextMock.mockResolvedValue(undefined);
    compareStore.addApi(makeApi("api-1", "Weather API"));
    compareStore.addApi(makeApi("api-2", "Payment API"));
    compareStore.setOpen(true);

    render(<CompareDrawer />);

    const copyBtn = screen.getByRole("button", { name: "Copy comparison link" });
    expect(copyBtn).toBeEnabled();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(parseCompareIds(new URL(copiedUrl).search)).toEqual(["api-1", "api-2"]);
    expect(
      await screen.findByText("Comparison link copied to clipboard."),
    ).toBeInTheDocument();
  });

  it("announces failure when clipboard write rejects", async () => {
    writeTextMock.mockRejectedValue(new Error("Clipboard denied"));
    compareStore.addApi(makeApi("api-1", "Weather API"));
    compareStore.setOpen(true);

    render(<CompareDrawer />);

    fireEvent.click(screen.getByRole("button", { name: "Copy comparison link" }));

    expect(
      await screen.findByText("Failed to copy comparison link."),
    ).toBeInTheDocument();
  });

  it("disables Copy link button when comparison is empty", () => {
    compareStore.setOpen(true);

    render(<CompareDrawer />);

    expect(
      screen.getByRole("button", { name: "Copy comparison link" }),
    ).toBeDisabled();
  });
});
