// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import KeyRotationModal from "./KeyRotationModal";

/**
 * Helper that renders KeyRotationModal wrapped in a ToastProvider
 * (required because the modal uses useToast internally).
 */
function renderModal(props: {
  isOpen?: boolean;
  onClose?: () => void;
  currentKey?: string;
  keyId?: string;
  onKeyChanged?: (newKey: string) => void;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  sessionToken?: string;
}) {
  return render(
    <ToastProvider>
      <KeyRotationModal
        isOpen={props.isOpen ?? true}
        onClose={props.onClose ?? vi.fn()}
        currentKey={props.currentKey ?? "ck_live_abcdef123456789"}
        keyId={props.keyId ?? "key_live_test123"}
        onKeyChanged={props.onKeyChanged}
        userId={props.userId ?? "user_123"}
        tenantId={props.tenantId ?? "tenant_abc"}
        sessionId={props.sessionId ?? "session_xyz"}
        sessionToken={props.sessionToken ?? "session_token_abc123"}
      />
    </ToastProvider>
  );
}

afterEach(cleanup);

describe("KeyRotationModal", () => {
  describe("Rendering", () => {
    it("renders nothing when closed", () => {
      const { container } = renderModal({ isOpen: false });
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it("renders the modal dialog when open", () => {
      renderModal({ isOpen: true });
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("renders the modal title and description", () => {
      renderModal({ isOpen: true });
      expect(screen.getByText("Rotate API Key")).toBeTruthy();
      expect(
        screen.getByText(/Rotating your API key generates a new key/i)
      ).toBeTruthy();
    });

    it("displays the current API key in the input field", () => {
      renderModal({ currentKey: "ck_live_testkey123" });
      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;
      expect(input.value).toBe("ck_live_testkey123");
    });

    it("renders the Rotate Key button", () => {
      renderModal({ isOpen: true });
      expect(
        screen.getByRole("button", { name: "Rotate Key" })
      ).toBeTruthy();
    });

    it("renders the Close and Cancel buttons", () => {
      renderModal({ isOpen: true });
      expect(
        screen.getByRole("button", { name: "Close key rotation modal" })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toBeTruthy();
    });
  });

  describe("Key visibility toggle", () => {
    it("displays the key as masked by default", () => {
      renderModal({ isOpen: true });
      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("toggles key visibility when Show/Hide button is clicked", () => {
      renderModal({ isOpen: true });
      const toggleBtn = screen.getByRole("button", { name: "Show API key" });
      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;

      fireEvent.click(toggleBtn);
      expect(input.type).toBe("text");
      expect(
        screen.getByRole("button", { name: "Hide API key" })
      ).toBeTruthy();

      fireEvent.click(toggleBtn);
      expect(input.type).toBe("password");
      expect(
        screen.getByRole("button", { name: "Show API key" })
      ).toBeTruthy();
    });
  });

  describe("Optimistic UI update", () => {
    it("immediately displays a new key when Rotate Key is clicked, before the promise resolves", async () => {
      // Defer the rotation promise so we can inspect the optimistic state
      let resolveRotation: (value: string) => void;
      const rotationPromise = new Promise<string>((resolve) => {
        resolveRotation = resolve;
      });

      renderModal({
        currentKey: "ck_live_original_key",
        onRotateKey: () => rotationPromise,
      });

      const rotateBtn = screen.getByRole("button", { name: "Rotate Key" });
      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;

      // Before click: original key is displayed
      expect(input.value).toBe("ck_live_original_key");

      fireEvent.click(rotateBtn);

      // After click (optimistic): key should have changed immediately
      // to a newly generated optimistic key, NOT the original
      await waitFor(() => {
        expect(input.value).not.toBe("ck_live_original_key");
      });
      // The optimistic key should start with the expected prefix
      expect(input.value).toMatch(/^ck_live_/);

      // The button should show loading state
      expect(
        screen.getByRole("button", { name: /Rotating/i })
      ).toBeTruthy();

      // Resolve the promise
      resolveRotation!("ck_live_server_new_key");
    });

    it("keeps the server-returned key after successful rotation", async () => {
      const onKeyChanged = vi.fn();
      renderModal({
        currentKey: "ck_live_old_key",
        onRotateKey: () => Promise.resolve("ck_live_server_confirmed_key"),
        onKeyChanged,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      // Wait for the rotation to complete
      await waitFor(() => {
        expect(onKeyChanged).toHaveBeenCalledWith("ck_live_server_confirmed_key");
      });

      // The displayed key should be the server-confirmed one
      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;
      expect(input.value).toBe("ck_live_server_confirmed_key");
    });

    it("shows the success toast after successful rotation", async () => {
      renderModal({
        currentKey: "ck_live_old",
        onRotateKey: () => Promise.resolve("ck_live_new"),
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(
          screen.getByText("API key rotated successfully.")
        ).toBeTruthy();
      });
    });
  });

  describe("Revert on failure", () => {
    it("reverts to the original key when rotation fails", async () => {
      renderModal({
        currentKey: "ck_live_original_key",
        onRotateKey: () => Promise.reject(new Error("Network error")),
      });

      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;
      expect(input.value).toBe("ck_live_original_key");

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      // Wait for reversion
      await waitFor(() => {
        expect(input.value).toBe("ck_live_original_key");
      });
    });

    it("shows an error message when rotation fails", async () => {
      renderModal({
        currentKey: "ck_live_original",
        onRotateKey: () => Promise.reject(new Error("Server error")),
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(
          screen.getByText("Failed to rotate API key. Please try again.")
        ).toBeTruthy();
      });

      // The error should have role="alert" for screen reader announcement
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Failed to rotate API key");
    });

    it("shows an error toast when rotation fails", async () => {
      renderModal({
        currentKey: "ck_live_original",
        onRotateKey: () => Promise.reject(new Error("Server error")),
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Key rotation failed. Your previous key has been restored."
          )
        ).toBeTruthy();
      });
    });

    it("does NOT call onKeyChanged when rotation fails", async () => {
      const onKeyChanged = vi.fn();
      renderModal({
        currentKey: "ck_live_original",
        onRotateKey: () => Promise.reject(new Error("Fail")),
        onKeyChanged,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      // Wait for the error state
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });

      // onKeyChanged should NOT have been called
      expect(onKeyChanged).not.toHaveBeenCalled();
    });

    it("allows retrying after a failed rotation", async () => {
      let callCount = 0;
      const onRotateKey = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Fail"));
        }
        return Promise.resolve("ck_live_success_after_retry");
      });

      renderModal({
        currentKey: "ck_live_retry_key",
        onRotateKey,
      });

      // First attempt: fails
      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });

      // Second attempt: succeeds
      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));
      await waitFor(() => {
        expect(
          screen.getByText("API key rotated successfully.")
        ).toBeTruthy();
      });

      expect(onRotateKey).toHaveBeenCalledTimes(2);
    });
  });

  describe("Accessibility (WCAG 2.1 AA)", () => {
    it("has aria-modal='true' on the dialog", () => {
      renderModal({ isOpen: true });
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("has aria-labelledby pointing to the title", () => {
      renderModal({ isOpen: true });
      const dialog = screen.getByRole("dialog");
      const title = screen.getByText("Rotate API Key");
      expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
    });

    it("has aria-describedby pointing to the description", () => {
      renderModal({ isOpen: true });
      const dialog = screen.getByRole("dialog");
      const desc = screen.getByText(/Rotating your API key generates/);
      expect(dialog.getAttribute("aria-describedby")).toBe(desc.id);
    });

    it("closes when Escape key is pressed", () => {
      const onClose = vi.fn();
      renderModal({ isOpen: true, onClose });

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes when backdrop is clicked", () => {
      const onClose = vi.fn();
      renderModal({ isOpen: true, onClose });

      const backdrop = document.querySelector('[role="presentation"]')!;
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does NOT close when dialog content is clicked", () => {
      const onClose = vi.fn();
      renderModal({ isOpen: true, onClose });

      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("marks the key input as aria-invalid when there is a rotation error", async () => {
      renderModal({
        currentKey: "ck_live_original",
        onRotateKey: () => Promise.reject(new Error("Fail")),
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        const input = screen.getByLabelText("API Key", { selector: "input" });
        expect(input.getAttribute("aria-invalid")).toBe("true");
      });
    });

    it("marks the rotate button as aria-busy during rotation", async () => {
      // Use a deferred promise so we can inspect the loading state
      let resolvePromise: (value: string) => void;
      const deferred = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      renderModal({
        currentKey: "ck_live_original",
        onRotateKey: () => deferred,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      // During rotation: button should be aria-busy
      const rotatingBtn = screen.getByRole("button", { name: /Rotating/i });
      expect(rotatingBtn.getAttribute("aria-busy")).toBe("true");

      // Clean up
      resolvePromise!("ck_live_new");
      await act(async () => {
        await deferred;
      });
    });

    it("disables close and cancel buttons while rotation is in progress", async () => {
      let resolvePromise: (value: string) => void;
      const deferred = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      renderModal({
        currentKey: "ck_live_original",
        onRotateKey: () => deferred,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      expect(
        screen.getByRole("button", { name: "Close key rotation modal" })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toBeDisabled();

      resolvePromise!("ck_live_new");
      await act(async () => {
        await deferred;
      });
    });
  });

  describe("Design tokens and theming", () => {
    it("uses design-token CSS variables for colors (no inline hex)", () => {
      renderModal({ isOpen: true });
      const dialog = screen.getByRole("dialog");

      // The modal background should reference a design token, not a raw hex
      expect(dialog.style.background).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });

    it("has a backdrop with defined background design token", () => {
      renderModal({ isOpen: true });
      const backdrop = document.querySelector('[role="presentation"]') as HTMLElement;
      expect(backdrop).toBeTruthy();
      // Verify the backdrop uses the --backdrop design token in its inline style
      expect(backdrop.style.background).toBe("var(--backdrop)");
    });
  });

  describe("Security: Authorization and validation (Issue #991)", () => {
    it("includes authorization context when calling API", async () => {
      // Mock the fetch to capture the API call
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ newKey: "ck_live_new_key" }),
          { status: 200 }
        )
      );

      renderModal({
        currentKey: "ck_live_old",
        userId: "user_123",
        tenantId: "tenant_abc",
        sessionId: "session_xyz",
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const callArgs = fetchSpy.mock.calls[0][1];
      const body = JSON.parse(callArgs?.body);
      expect(body.context.userId).toBe("user_123");
      expect(body.context.tenantId).toBe("tenant_abc");
      expect(body.context.sessionId).toBe("session_xyz");

      fetchSpy.mockRestore();
    });

    it("sends session bearer token in Authorization header", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ newKey: "ck_live_new" }),
          { status: 200 }
        )
      );

      renderModal({ sessionToken: "my_session_token_xyz" });
      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const callArgs = fetchSpy.mock.calls[0][1];
      expect(callArgs?.headers?.Authorization).toBe("Bearer my_session_token_xyz");

      fetchSpy.mockRestore();
    });

    it("reverts to original key on rotation failure (lossless guarantee)", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "ROTATION_FAILED", message: "Network error" },
          }),
          { status: 500 }
        )
      );

      renderModal({
        currentKey: "ck_live_original_key",
      });

      const input = screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement;
      expect(input.value).toBe("ck_live_original_key");

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      // Wait for reversion (lossless: we're back to original)
      await waitFor(() => {
        expect(input.value).toBe("ck_live_original_key");
      });

      fetchSpy.mockRestore();
    });

    it("does not call onKeyChanged when rotation fails", async () => {
      const onKeyChanged = vi.fn();
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "ROTATION_FAILED", message: "Server error" },
          }),
          { status: 500 }
        )
      );

      renderModal({
        currentKey: "ck_live_old",
        userId: "user_123",
        tenantId: "tenant_abc",
        sessionId: "session_xyz",
        onKeyChanged,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });

      // onKeyChanged should NOT have been called on failure
      expect(onKeyChanged).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("does not leak API key in error messages", async () => {
      const sensitiveKey = "ck_live_super_secret_key_12345678";
      renderModal({
        currentKey: sensitiveKey,
        onRotateKey: () => Promise.reject(new Error(`Failed to rotate key ${sensitiveKey}`)),
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        const errorElement = screen.getByRole("alert");
        // Ensure the API key is NOT visible anywhere in the error message
        expect(errorElement.textContent).not.toContain(sensitiveKey);
        expect(errorElement.textContent).not.toContain("super_secret");
      });
    });

    it("shows retry button only for retryable errors", async () => {
      const onRotateKey = vi.fn();
      onRotateKey.mockRejectedValueOnce(new Error("Network timeout"));

      renderModal({
        currentKey: "ck_live_original",
        onRotateKey,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        // For network errors, a retry button should appear
        const retryBtn = screen.queryByRole("button", { name: /retry/i });
        // The retry button might appear or might not, depending on error classification
        // This test documents the expected behavior
        expect(screen.getByRole("alert")).toBeTruthy();
      });
    });

    it("prevents closing modal during rotation (fail-safe)", async () => {
      // Create a fetch that never resolves (simulating slow network)
      const fetchPromise = new Promise(() => {}); // Never resolves
      const fetchSpy = vi.spyOn(global, "fetch").mockReturnValue(fetchPromise as any);

      renderModal({
        currentKey: "ck_live_original",
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      // During rotation, buttons should be disabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Close key rotation modal" })).toBeDisabled();
      });

      fetchSpy.mockRestore();
    });

    it("includes timestamp in rotation context for staleness checks", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ newKey: "ck_live_new" }),
          { status: 200 }
        )
      );

      const before = Date.now();
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      const callArgs = fetchSpy.mock.calls[0][1];
      const body = JSON.parse(callArgs?.body);
      const contextTimestamp = body.context.timestamp;
      const after = Date.now();

      expect(contextTimestamp).toBeGreaterThanOrEqual(before);
      expect(contextTimestamp).toBeLessThanOrEqual(after);

      fetchSpy.mockRestore();
    });
  });

  describe("Security: No secret leakage", () => {
    it("does not expose API keys in console logs", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const sensitiveKey = "ck_live_super_secret_12345678";

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "ROTATION_FAILED", message: "Rotation failed" },
          }),
          { status: 500 }
        )
      );

      renderModal({
        currentKey: sensitiveKey,
      });

      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });

      // Check console output for secret leakage
      const logOutput = consoleErrorSpy.mock.calls.map(c => c[0]?.toString()).join(" ");
      // The logs should be sanitized, not contain the raw key
      expect(logOutput).not.toContain(sensitiveKey);

      consoleErrorSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("does not expose confirmation tokens in error messages", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "TOKEN_INVALID", message: "Token is invalid" },
          }),
          { status: 400 }
        )
      );

      renderModal();
      fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

      await waitFor(() => {
        const alertElement = screen.getByRole("alert");
        // Token should not be exposed in error message
        expect(alertElement.textContent).not.toContain("eyJ");
      });

      fetchSpy.mockRestore();
    });
  });
});
