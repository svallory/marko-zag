import marko from "@marko/vite";
import { defineConfig } from "vitest/config";

// Server-render suite: compiles real .marko templates through @marko/vite and
// renders them in Node with no DOM present, so the SSR half of the <service>
// contract (server-side throwaway service, serialized resume payload) is
// tested against actual output rather than a hand-built stand-in.
//
// Separate from vitest.config.ts because that suite runs in jsdom with no
// Marko plugin, and from vitest.browser.config.ts because this one must have
// no DOM at all.
export default defineConfig({
  plugins: [marko({ linked: false })],
  test: {
    environment: "node",
    include: ["tests/ssr/**/*.test.ts"],
  },
});
