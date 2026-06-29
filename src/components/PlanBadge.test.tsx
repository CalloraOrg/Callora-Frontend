// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PlanBadge from "./PlanBadge";

describe("PlanBadge", () => {
  afterEach(() => cleanup());

  it("renders the tier label", () => {
    render(<PlanBadge tier="pro" />);
    expect(screen.getByText("Pro")).toBeTruthy();
  });

  it("exposes rate-limit details in the accessible name", () => {
    render(<PlanBadge tier="free" />);
    expect(
      screen.getByLabelText(/free plan\. rate limit: 60 requests \/ minute\./i),
    ).toBeTruthy();
  });

  it("reveals a tooltip with rate-limit details on focus", () => {
    render(<PlanBadge tier="enterprise" />);
    fireEvent.focus(screen.getByText("Enterprise"));
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Enterprise plan");
    expect(tip.textContent).toContain("Custom / unmetered");
  });
});
