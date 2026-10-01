import { afterEach, describe, expect, it, vi } from "vitest";

describe("demo outcome configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("requires both a development build and an explicit flag", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ENABLE_DEMO_OUTCOME", "true");
    vi.resetModules();
    const productionConstants = await import("./constants");
    expect(productionConstants.ENABLE_DEMO_OUTCOME).toBe(false);

    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ENABLE_DEMO_OUTCOME", "false");
    vi.resetModules();
    const disabledConstants = await import("./constants");
    expect(disabledConstants.ENABLE_DEMO_OUTCOME).toBe(false);

    vi.stubEnv("VITE_ENABLE_DEMO_OUTCOME", "true");
    vi.resetModules();
    const enabledConstants = await import("./constants");
    expect(enabledConstants.ENABLE_DEMO_OUTCOME).toBe(true);
  });
});
