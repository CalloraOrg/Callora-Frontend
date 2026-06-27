// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Optional: include files with .test. or .spec.
    include: ['src/**/*.test.{ts,tsx}'],
    // Setup files can be added if needed.
    // setupFiles: './src/setupTests.ts',
    // Enable CSS handling if components import CSS.
    css: true,
  },
});
