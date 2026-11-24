import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormField from "./FormField";
import type { FormFieldCounter, FormFieldProps } from "./FormField";

type RenderOptions = Partial<Omit<FormFieldProps, "children">> & {
  childProps?: Record<string, unknown>;
};

function renderField({
  id = "name",
  label = "Name",
  status = "idle",
  childProps,
  ...rest
}: RenderOptions = {}) {
  return render(
    <FormField id={id} label={label} status={status} {...rest}>
      <input id={id} {...childProps} />
    </FormField>,
  );
}

function getInput() {
  return screen.getByLabelText(/^Name/) as HTMLInputElement;
}

function getCounter(counter: FormFieldCounter) {
  return screen.getByText(`${counter.current} / ${counter.max}`);
}

describe("FormField", () => {
  describe("label wiring", () => {
    it("associates the label with the field", () => {
      renderField();

      expect(getInput()).toHaveAttribute("id", "name");
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("hides the required marker from the accessible name", () => {
      renderField({ required: true });

      const input = getInput();
      expect(input).toHaveAccessibleName("Name");
      expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
    });

    it("renders a success tick with the accessible label 'valid'", () => {
      renderField({ status: "success" });

      expect(screen.getByLabelText("valid")).toBeInTheDocument();
    });

    it("does not render the success tick for idle or error statuses", () => {
      renderField({ status: "error", error: "Required" });
      expect(screen.queryByLabelText("valid")).not.toBeInTheDocument();
    });
  });

  describe("aria-describedby composition", () => {
    it("references only the error region when no hint or counter is provided", () => {
      renderField();

      expect(getInput()).toHaveAttribute("aria-describedby", "name-error");
    });

    it("adds the hint when one is provided", () => {
      renderField({ hint: "Your display name" });

      expect(getInput()).toHaveAttribute(
        "aria-describedby",
        "name-hint name-error",
      );
      expect(screen.getByText("Your display name")).toHaveAttribute(
        "id",
        "name-hint",
      );
    });

    it("adds the counter when one is provided", () => {
      renderField({ counter: { current: 2, max: 10 } });

      expect(getInput()).toHaveAttribute(
        "aria-describedby",
        "name-counter name-error",
      );
      expect(getCounter({ current: 2, max: 10 })).toHaveAttribute(
        "id",
        "name-counter",
      );
    });

    it("orders hint then counter then error", () => {
      renderField({
        hint: "Your display name",
        counter: { current: 2, max: 10 },
      });

      expect(getInput()).toHaveAttribute(
        "aria-describedby",
        "name-hint name-counter name-error",
      );
    });

    it("keeps an existing aria-describedby first", () => {
      renderField({
        hint: "Your display name",
        counter: { current: 2, max: 10 },
        childProps: { "aria-describedby": "external-help" },
      });

      expect(getInput()).toHaveAttribute(
        "aria-describedby",
        "external-help name-hint name-counter name-error",
      );
    });

    it("treats an empty hint as absent", () => {
      const { container } = renderField({ hint: "" });

      expect(getInput()).toHaveAttribute("aria-describedby", "name-error");
      expect(container.querySelector(".ff-hint")).toBeNull();
    });
  });

  describe("error state", () => {
    it("marks the field invalid only when the status is error", () => {
      const { rerender } = renderField({ status: "error", error: "Required" });
      expect(getInput()).toHaveAttribute("aria-invalid", "true");

      rerender(
        <FormField id="name" label="Name" status="idle">
          <input id="name" />
        </FormField>,
      );
      expect(getInput()).not.toHaveAttribute("aria-invalid");
    });

    it("shows the error text when the status is error", () => {
      renderField({ status: "error", error: "Please enter your name" });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please enter your name",
      );
    });

    it("hides the error text when the status is not error", () => {
      renderField({ status: "idle", error: "Please enter your name" });

      expect(screen.getByRole("alert")).toHaveTextContent("");
    });

    it("hides the error text when no message is provided", () => {
      renderField({ status: "error" });

      expect(screen.getByRole("alert")).toHaveTextContent("");
    });

    it("keeps the error region in the DOM and assertive for announcements", () => {
      renderField();

      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("id", "name-error");
      expect(alert).toHaveAttribute("aria-live", "assertive");
    });
  });

  describe("character counter", () => {
    it("stays quiet while more than 50 characters remain", () => {
      const counter = { current: 0, max: 100 };
      renderField({ counter });

      const el = getCounter(counter);
      expect(el).toHaveAttribute("aria-live", "off");
      expect(el.className).not.toContain("ff-counter--near");
      expect(el.className).not.toContain("ff-counter--over");
    });

    it("announces politely when fewer than 50 characters remain", () => {
      const counter = { current: 51, max: 100 };
      renderField({ counter });

      const el = getCounter(counter);
      expect(el).toHaveAttribute("aria-live", "polite");
      expect(el.className).toContain("ff-counter--near");
      expect(el.className).not.toContain("ff-counter--over");
    });

    it("flags an over-limit count as over rather than near", () => {
      const counter = { current: 11, max: 10 };
      renderField({ counter });

      const el = getCounter(counter);
      expect(el).toHaveAttribute("aria-live", "polite");
      expect(el.className).toContain("ff-counter--over");
      expect(el.className).not.toContain("ff-counter--near");
    });

    it("treats a max of 0 as near the limit", () => {
      const counter = { current: 0, max: 0 };
      renderField({ counter });

      expect(getCounter(counter).className).toContain("ff-counter--near");
    });

    it("handles a negative remaining count", () => {
      const counter = { current: 150, max: 100 };
      renderField({ counter });

      const el = getCounter(counter);
      expect(el).toHaveAttribute("aria-live", "polite");
      expect(el.className).toContain("ff-counter--over");
    });
  });
});
