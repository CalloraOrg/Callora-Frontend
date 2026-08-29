// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Optional: include files with .test. or .spec.
    include: ["src/**/*.test.{ts,tsx}"],
    // Enable CSS handling if components import CSS.
    css: true,
    setupFiles: ["src/setupTests.ts"],
  },
});
