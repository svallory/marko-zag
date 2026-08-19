import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
