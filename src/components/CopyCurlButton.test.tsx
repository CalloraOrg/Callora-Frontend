// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CopyCurlButton from "./CopyCurlButton";

describe("CopyCurlButton", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders an accessible default label", () => {
    render(<CopyCurlButton request={{ url: "https://x.test/ping" }} />);
    expect(
      screen.getByRole("button", { name: /copy request as a curl command/i }),
    ).toBeTruthy();
    expect(screen.getByText("Copy as cURL")).toBeTruthy();
  });

  it("writes the cURL command to the clipboard on click", async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    render(
      <CopyCurlButton
        request={{ method: "POST", url: "https://x.test/echo", body: { a: 1 } }}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("curl -X POST 'https://x.test/echo'");
    expect(copied).toContain('--data \'{"a":1}\'');
  });

  it("shows success feedback after copying", async () => {
    render(<CopyCurlButton request={{ url: "https://x.test/ping" }} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    expect(
      screen.getByText("cURL command copied to clipboard"),
    ).toBeTruthy();
  });
});
