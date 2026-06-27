// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import MarketplacePage from "./MarketplacePage";
import { DENSITY_STORAGE_KEY } from "../utils/density";

describe("MarketplacePage density toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("persists compact selection and exposes toggle state", async () => {
    render(<MarketplacePage />);

    const compactButton = screen.getByRole("button", { name: /compact/i });
    fireEvent.click(compactButton);

    await waitFor(() => {
      expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
    });

    expect(compactButton.getAttribute("aria-pressed")).toBe("true");
  });
});
