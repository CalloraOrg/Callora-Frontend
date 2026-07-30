import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import Sparkline from "./Sparkline";

describe("Sparkline Component", () => {
  it("renders an empty SVG when values are empty", () => {
    const { container } = render(<Sparkline values={[]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("polyline")).toBeNull();
  });

  it("renders polyline with correct points when values are provided", () => {
    const values = [10, 20, 30];
    const { container } = render(<Sparkline values={values} width={100} height={50} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeTruthy();

    const points = polyline?.getAttribute("points");
    expect(points).toBeTruthy();

    // Values: [10, 20, 30]
    // min = 10, max = 30, range = 20
    // Index 0: value 10 -> x = 0, y = 50 - ((10 - 10) / 20) * 50 = 50. Point: "0,50"
    // Index 1: value 20 -> x = 50, y = 50 - ((20 - 10) / 20) * 50 = 25. Point: "50,25"
    // Index 2: value 30 -> x = 100, y = 50 - ((30 - 10) / 20) * 50 = 0. Point: "100,0"
    expect(points).toBe("0,50 50,25 100,0");
  });

  it("applies default and custom styling props properly", () => {
    const values = [10, 20, 30];
    const { container, rerender } = render(<Sparkline values={values} />);
    
    // Defaults: width=80, height=24, color="var(--accent, #4f8cff)"
    let svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("80");
    expect(svg?.getAttribute("height")).toBe("24");
    
    let polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("stroke")).toBe("var(--accent, #4f8cff)");

    // Custom values
    rerender(<Sparkline values={values} width={120} height={40} color="#ff0000" />);
    svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("120");
    expect(svg?.getAttribute("height")).toBe("40");
    
    polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("stroke")).toBe("#ff0000");
  });

  it("includes correct accessibility role and label", () => {
    render(<Sparkline values={[10, 20, 30]} />);
    const svg = screen.getByRole("img", { name: "Last 24 hour trend" });
    expect(svg).toBeTruthy();
  });

  it("handles edge case of identical values without division by zero errors", () => {
    const values = [15, 15, 15];
    const { container } = render(<Sparkline values={values} width={80} height={20} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeTruthy();

    const points = polyline?.getAttribute("points");
    expect(points).toBeTruthy();

    // Values: [15, 15, 15]
    // min = 15, max = 15, range = max - min || 1 = 1.
    // Index 0: value 15 -> x = 0, y = 20 - ((15 - 15) / 1) * 20 = 20. Point: "0,20"
    // Index 1: value 15 -> x = 40, y = 20 - ((15 - 15) / 1) * 20 = 20. Point: "40,20"
    // Index 2: value 15 -> x = 80, y = 20 - ((15 - 15) / 1) * 20 = 20. Point: "80,20"
    expect(points).toBe("0,20 40,20 80,20");
  });
});
