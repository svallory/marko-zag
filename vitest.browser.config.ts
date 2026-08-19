import marko from "@marko/vite";
import { defineConfig } from "vitest/config";

// Real-Chromium suite complementing the jsdom suite in vitest.config.ts.
// Covers what jsdom cannot: floating-ui/popper layout for tooltip
// positioning, real pointer/timer semantics, and Marko's actual runtime
// applying spread attrs to native elements (property vs attribute writes).
export default defineConfig({
  plugins: [marko()],
  test: {
    include: ["tests/browser/**/*.test.ts"],
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
