import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReviewForm, {
  MIN_REVIEW_LENGTH,
  MAX_REVIEW_LENGTH,
} from "./ReviewForm";

describe("ReviewForm", () => {
  it("validates missing rating and empty review text", () => {
    const onSubmit = vi.fn();
    render(<ReviewForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Submit Review/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Please select a star rating/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Please write a review/i).length).toBeGreaterThan(0);
  });

  it("validates too-short and too-long review text", () => {
    const onSubmit = vi.fn();
    render(<ReviewForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));

    const textarea = screen.getByLabelText(/Your review/i);
    fireEvent.change(textarea, { target: { value: "Too short" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit Review/i }));
    expect(
      screen.getAllByText(new RegExp(`at least ${MIN_REVIEW_LENGTH} characters`, "i")).length,
    ).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(textarea, {
      target: { value: "a".repeat(MAX_REVIEW_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit Review/i }));
    expect(
      screen.getAllByText(new RegExp(`${MAX_REVIEW_LENGTH} characters or fewer`, "i")).length,
    ).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("supports keyboard navigation for star rating and Escape to cancel", () => {
    const onCancel = vi.fn();
    render(<ReviewForm onSubmit={vi.fn()} onCancel={onCancel} />);

    const star1 = screen.getByRole("radio", { name: "1 star" });
    fireEvent.keyDown(star1, { key: "ArrowRight" });

    const star2 = screen.getByRole("radio", { name: "2 stars" });
    expect(star2).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(star2, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("prevents double submission when Submit Review is clicked twice rapidly", async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<ReviewForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    fireEvent.change(screen.getByLabelText(/Your review/i), {
      target: { value: "This API is super fast and reliable!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Review/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      body: "This API is super fast and reliable!",
    });

    resolveSubmit();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Submit Review/i }),
      ).not.toBeDisabled();
    });
  });

  it("announces server errors via live region and restores initial draft", () => {
    render(
      <ReviewForm
        initialRating={3}
        initialBody="Restored draft review text."
        serverError="Server rejected the review."
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "3 stars" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText(/Your review/i)).toHaveValue(
      "Restored draft review text.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Server rejected the review.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Server rejected the review.",
    );
  });
});
