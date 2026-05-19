import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [
      "./tests/core/setup.ts",
      "./tests/zyins/setup.ts",
      "./tests/rapidsign/setup.ts",
      "./tests/proxy/setup.ts",
    ],
  },
});
