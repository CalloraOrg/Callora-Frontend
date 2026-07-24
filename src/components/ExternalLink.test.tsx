// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ExternalLink from "./ExternalLink";

describe("ExternalLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children correctly", () => {
    render(<ExternalLink href="https://example.com">Example</ExternalLink>);
    expect(screen.getByText("Example").tagName).toBe("A");
  });

  it("adds target and rel for external http links", () => {
    render(
      <ExternalLink href="https://docs.example.com">
        External docs
      </ExternalLink>,
    );

    const link = screen.getByText("External docs");
    expect(link.getAttribute("href")).toBe("https://docs.example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("adds aria-label describing external navigation", () => {
    render(
      <ExternalLink href="https://docs.example.com" ariaLabel="API docs">
        API docs
      </ExternalLink>,
    );

    const link = screen.getByLabelText("API docs, opens in new tab");
    expect(link).toBeTruthy();
  });

  it("renders external link icon from lucide-react for external URLs", () => {
    const { container } = render(
      <ExternalLink href="https://example.com">External</ExternalLink>,
    );

    const link = container.querySelector("a");
    const iconSpan = link?.querySelector("span[aria-hidden]");
    expect(iconSpan).toBeTruthy();
    expect(iconSpan?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not add external attributes for internal relative links", () => {
    render(<ExternalLink href="/docs">Docs</ExternalLink>);

    const link = screen.getByText("Docs");
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();
  });

  it("does not add external attributes for hash links", () => {
    render(<ExternalLink href="#section">Section</ExternalLink>);

    const link = screen.getByText("Section");
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();
  });

  it("does not add external attributes for same-origin absolute links when mocked", () => {
    const originalOrigin = window.location.origin;
    Object.defineProperty(window, "location", {
      value: { origin: "https://callora.io" },
      writable: true,
    });

    render(<ExternalLink href="https://callora.io/docs">docs</ExternalLink>);

    const link = screen.getByText("docs");
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();

    Object.defineProperty(window, "location", {
      value: { origin: originalOrigin },
      writable: true,
    });
  });

  it("passes through additional anchor props", () => {
    render(
      <ExternalLink
        href="https://example.com"
        title="External site"
        className="custom-link"
      >
        Site
      </ExternalLink>,
    );

    const link = screen.getByText("Site");
    expect(link.getAttribute("title")).toBe("External site");
    expect(link.getAttribute("class")).toBe("custom-link");
  });

  it("does not render an icon for internal links", () => {
    const { container } = render(
      <ExternalLink href="/marketplace">Marketplace</ExternalLink>,
    );

    const link = container.querySelector("a");
    expect(link?.querySelector("svg")).toBeNull();
  });

  it("does not set an aria-label for internal links without one", () => {
    render(<ExternalLink href="/docs">Docs</ExternalLink>);

    const link = screen.getByText("Docs");
    expect(link.getAttribute("aria-label")).toBeNull();
  });

  it("treats undefined href as internal", () => {
    render(<ExternalLink>Missing href</ExternalLink>);

    const link = screen.getByText("Missing href");
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();
  });

  it("supports hideIcon prop to suppress external link icon", () => {
    const { container } = render(
      <ExternalLink href="https://example.com" hideIcon>
        External
      </ExternalLink>,
    );

    const link = container.querySelector("a");
    expect(link?.querySelector("svg")).toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("sets aria-label to just 'opens in new tab' when no custom label provided", () => {
    render(<ExternalLink href="https://example.com">External</ExternalLink>);

    const link = screen.getByLabelText("opens in new tab");
    expect(link).toBeTruthy();
  });

  it("handles missing href gracefully", () => {
    render(
      <ExternalLink href="">
        No href
      </ExternalLink>,
    );

    const link = screen.getByText("No href");
    expect(link.getAttribute("href")).toBe("");
    expect(link.getAttribute("target")).toBeNull();
  });
});

