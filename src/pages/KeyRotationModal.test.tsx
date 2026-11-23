// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import KeyRotationModal from "./KeyRotationModal";
import * as KeyRotationApi from "../services/KeyRotationApi";
import { ToastProvider } from "../components/Toast";

function renderModal(props: Partial<React.ComponentProps<typeof KeyRotationModal>> = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentKey: "ck_live_original_key_111",
    keyId: "key-abc-123",
    sessionToken: "valid-session-bearer-token",
    onKeyChanged: vi.fn(),
  };

  return render(
    <ToastProvider>
      <KeyRotationModal {...defaultProps} {...props} />
    </ToastProvider>
  );
}

describe("KeyRotationModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open and traps focus", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Rotate API Key")).toBeTruthy();
    expect(screen.getByDisplayValue("ck_live_original_key_111")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("requests token on confirm then rotates key successfully", async () => {
    const onKeyChanged = vi.fn();
    const tokenSpy = vi.spyOn(KeyRotationApi, "getRotationToken").mockResolvedValue({
      token: "server-issued-opaque-token",
      expiresIn: 900,
    });

    const rotateSpy = vi.spyOn(KeyRotationApi, "rotateKeyWithToken").mockResolvedValue({
      success: true,
      newKey: "ck_live_newly_rotated_key_222",
    });

    renderModal({ onKeyChanged });

    const rotateBtn = screen.getByRole("button", { name: "Rotate Key" });
    fireEvent.click(rotateBtn);

    await waitFor(() => {
      expect(tokenSpy).toHaveBeenCalledWith("key-abc-123", "valid-session-bearer-token");
    });

    await waitFor(() => {
      expect(rotateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          keyId: "key-abc-123",
          confirmationToken: "server-issued-opaque-token",
        }),
        "valid-session-bearer-token"
      );
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("ck_live_newly_rotated_key_222")).toBeTruthy();
      expect(onKeyChanged).toHaveBeenCalledWith("ck_live_newly_rotated_key_222");
    });
  });

  it("handles token request error, shows safe error and enables retry button", async () => {
    const tokenSpy = vi.spyOn(KeyRotationApi, "getRotationToken").mockResolvedValue({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      },
    });

    renderModal();

    const rotateBtn = screen.getByRole("button", { name: "Rotate Key" });
    fireEvent.click(rotateBtn);

    await waitFor(() => {
      expect(tokenSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/permission|authorized/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    });

    // Clicking retry attempts the token request again
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(tokenSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("prevents double-confirm while rotation is in-flight", async () => {
    let resolveToken: (value: any) => void;
    const tokenPromise = new Promise((resolve) => {
      resolveToken = resolve;
    });

    const tokenSpy = vi.spyOn(KeyRotationApi, "getRotationToken").mockReturnValue(tokenPromise as any);

    renderModal();

    const rotateBtn = screen.getByRole("button", { name: "Rotate Key" });
    fireEvent.click(rotateBtn);
    fireEvent.click(rotateBtn);

    expect(tokenSpy).toHaveBeenCalledTimes(1);

    resolveToken!({
      token: "server-token-1",
    });
  });

  it("reverts displayed key if backend rotation fails", async () => {
    vi.spyOn(KeyRotationApi, "getRotationToken").mockResolvedValue({
      token: "valid-server-token",
    });

    vi.spyOn(KeyRotationApi, "rotateKeyWithToken").mockResolvedValue({
      success: false,
      error: {
        code: "ROTATION_FAILED",
        message: "Failed to rotate API key. Please try again.",
      },
    });

    renderModal({ currentKey: "ck_live_original_key_111" });

    const rotateBtn = screen.getByRole("button", { name: "Rotate Key" });
    fireEvent.click(rotateBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("ck_live_original_key_111")).toBeTruthy();
    });
  });

  it("never logs confirmation token or secrets to console", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sensitiveToken = "super-sensitive-opaque-token-do-not-log";

    vi.spyOn(KeyRotationApi, "getRotationToken").mockResolvedValue({
      token: sensitiveToken,
    });

    vi.spyOn(KeyRotationApi, "rotateKeyWithToken").mockRejectedValue(
      new Error("Network disconnect")
    );

    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Rotate Key" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    for (const call of consoleSpy.mock.calls) {
      const output = call.map(String).join(" ");
      expect(output).not.toContain(sensitiveToken);
    }
  });
});
