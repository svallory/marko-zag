import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser/**", "tests/ssr/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
