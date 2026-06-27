import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchBar from "./SearchBar";

describe("SearchBar", () => {
  it("renders a search input with an accessible label", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByRole("searchbox", { name: /search apis/i })).toBeTruthy();
  });

  it("does not hard-code an inline outline override on the input", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    const input = screen.getByRole("searchbox", { name: /search apis/i }) as HTMLInputElement;
    // The ring must come from `@layer focus`, never an inline outline hack.
    expect(input.style.outline).toBe("");
  });

  it("clears the value when Escape is pressed", () => {
    const onChange = vi.fn();
    render(<SearchBar value="hello" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search apis/i }), { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("invokes onSearch when Enter is pressed", () => {
    const onSearch = vi.fn();
    render(<SearchBar value="maps" onChange={() => {}} onSearch={onSearch} />);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search apis/i }), { key: "Enter" });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("shows a clear button that resets the value", () => {
    const onChange = vi.fn();
    render(<SearchBar value="stripe" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});