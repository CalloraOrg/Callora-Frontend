// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

describe("LandingPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders landing page content without testimonial placeholders", () => {
    render(
      <MemoryRouter>
        <LandingPage onStartUsingApis={() => {}} onPublishApi={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText("Callora - Programmable API Access")).toBeTruthy();
    expect(screen.queryByText(/Case study/i)).toBeNull();
    expect(screen.queryByText(/Customer quote/i)).toBeNull();
    expect(screen.queryByText(/Testimonials/i)).toBeNull();
    expect(screen.getByRole("heading", { name: "Where Callora shines", level: 3 })).toBeTruthy();
    expect(screen.getByText(/Pay-per-call billing with transparent micro-payments in USDC/i)).toBeTruthy();
  });
});
