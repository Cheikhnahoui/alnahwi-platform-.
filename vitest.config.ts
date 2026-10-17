import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each file boots an in-memory PostgreSQL and runs the migrations, and the sign-in tests
    // deliberately use slow password hashing, so slower machines need generous limits.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});