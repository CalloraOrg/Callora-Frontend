// @vitest-environment jsdom

import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TagIcon, CheckIcon, WarningIcon, BoltIcon, ClockIcon, InfoIcon } from "./index";

const iconComponents = [
  { name: "TagIcon", Component: TagIcon },
  { name: "CheckIcon", Component: CheckIcon },
  { name: "WarningIcon", Component: WarningIcon },
  { name: "BoltIcon", Component: BoltIcon },
  { name: "ClockIcon", Component: ClockIcon },
  { name: "InfoIcon", Component: InfoIcon },
];

describe("Theme-Aware SVG Icon Set", () => {
  afterEach(() => {
    cleanup();
  });

  iconComponents.forEach(({ name, Component }) => {
    describe(name, () => {
      it("renders with default size 16 and aria-hidden", () => {
        const { container } = render(<Component />);
        const svg = container.querySelector("svg");
        
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute("width")).toBe("16");
        expect(svg?.getAttribute("height")).toBe("16");
        expect(svg?.getAttribute("aria-hidden")).toBe("true");
        expect(svg?.getAttribute("stroke-width")).toBe("1.6");
        expect(svg?.getAttribute("fill")).toBe("none");
      });

      it("respects size prop of 20", () => {
        const { container } = render(<Component size={20} />);
        const svg = container.querySelector("svg");
        
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute("width")).toBe("20");
        expect(svg?.getAttribute("height")).toBe("20");
      });

      it("overrides aria-hidden when aria-label is provided", () => {
        const { container } = render(<Component aria-label="custom label" />);
        const svg = container.querySelector("svg");
        
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute("aria-hidden")).toBeNull();
        expect(svg?.getAttribute("aria-label")).toBe("custom label");
      });

      it("passes through standard SVG attributes", () => {
        const { container } = render(<Component className="custom-icon-class" data-testid="icon" />);
        const svg = container.querySelector("svg");
        
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute("class")).toContain("custom-icon-class");
        expect(svg?.getAttribute("data-testid")).toBe("icon");
      });
    });
  });
});
