import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../ThemeContext";
import ThemePlayground from "./ThemePlayground";

describe("ThemePlayground", () => {
  it("updates preview tokens live and resets to defaults", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <ThemePlayground />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("heading", { name: /theme playground/i }),
    ).toBeInTheDocument();

    const primaryInput = screen.getByLabelText(/primary token/i);
    fireEvent.input(primaryInput, { target: { value: "#ff6600" } });

    const previewButton = screen.getByRole("button", {
      name: /preview action/i,
    });
    expect(previewButton).toHaveStyle({ backgroundColor: "#ff6600" });

    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));

    expect(previewButton).toHaveStyle({ backgroundColor: "#4e85ff" });
  });
});
