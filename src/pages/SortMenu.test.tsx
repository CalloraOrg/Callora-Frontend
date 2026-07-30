import React from "react";
import { render, screen } from "@testing-library/react";
import SortMenu from "./SortMenu";
import fs from "fs";
import path from "path";

describe("SortMenu print behavior", () => {
  test("renders collapsible sections", () => {
    render(<SortMenu />);
    expect(screen.getByText("Sort Options")).toBeInTheDocument();
    expect(screen.getByText("Advanced Filters")).toBeInTheDocument();
  });

  test("print stylesheet exists and contains print rules", () => {
    const cssPath = path.resolve(__dirname, "../styles/print.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toMatch(/@media print/);
    expect(css).toMatch(/\.no-print/);
    expect(css).toMatch(/details\s*>\s*\*/);
  });
});
