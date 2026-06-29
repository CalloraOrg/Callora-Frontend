import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import MyApis from "./MyApis";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useDocumentTitle hook
vi.mock("../hooks/useDocumentTitle", () => ({
  default: vi.fn(),
}));

describe("MyApis Page", () => {
  it("renders the empty state with correct title and message", () => {
    render(
      <MemoryRouter>
        <MyApis />
      </MemoryRouter>
    );

    expect(screen.getByText("No APIs published yet")).toBeTruthy();
    expect(
      screen.getByText(/You haven't listed any APIs on the marketplace/i)
    ).toBeTruthy();
  });

  it("renders the 'Publish your first API' CTA button", () => {
    render(
      <MemoryRouter>
        <MyApis />
      </MemoryRouter>
    );

    const ctaButton = screen.getByRole("button", { name: /Publish your first API/i });
    expect(ctaButton).toBeTruthy();
  });

  it("navigates to the publish page when the CTA button is clicked", () => {
    render(
      <MemoryRouter>
        <MyApis />
      </MemoryRouter>
    );

    const ctaButton = screen.getByRole("button", { name: /Publish your first API/i });
    fireEvent.click(ctaButton);

    expect(mockNavigate).toHaveBeenCalledWith("/publish");
  });
});
