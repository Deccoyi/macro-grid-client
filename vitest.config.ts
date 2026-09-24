import { defineConfig } from "vitest/config";

// Unit tests for the app code in src/. The renderer package has its own config and suite.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
