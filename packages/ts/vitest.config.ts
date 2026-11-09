import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Runs under `bun test` (the `test:bun` script), not vitest: it imports bun:test.
    exclude: ["tests/zyins/isa-session-zyins.test.ts", "**/node_modules/**"],
    setupFiles: [
      "./tests/core/setup.ts",
      "./tests/zyins/setup.ts",
      "./tests/rapidsign/setup.ts",
      "./tests/proxy/setup.ts",
    ],
  },
});
